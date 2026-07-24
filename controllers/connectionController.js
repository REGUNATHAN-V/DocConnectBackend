const { v4: uuidv4 } = require("uuid");
const Connection = require("../models/Connection");
const User = require("../models/User");
const { broadcastAll } = require("../socket/broadcast");

// Returns the Set of userIds that `userId` has an ACCEPTED connection with.
async function getConnectedIds(userId) {
  const docs = await Connection.find({
    status: "accepted",
    $or: [{ requester: userId }, { recipient: userId }],
  });
  return new Set(docs.map((d) => (d.requester === userId ? d.recipient : d.requester)));
}

function toPublicUser(userDoc) {
  return {
    userId: userDoc.userId,
    name: userDoc.name,
    role: userDoc.role,
    profilePic: userDoc.profilePic,
  };
}

// Attaches, relative to `viewerUserId`, to each user in `candidates`:
//   connectionStatus: "none" | "pending_sent" | "pending_received" | "connected"
//   connectionId:     the Connection doc id, if one exists
//   connectsCount:    mutual accepted connections between viewer & candidate
//
// NOTE: this does one query per candidate to compute mutual counts. Fine for
// page sizes of 10-20 (typical discover/search pages); if you ever raise the
// page size a lot, this is the first thing to optimize (e.g. an aggregation
// pipeline instead of N queries).
async function attachConnectionInfo(candidates, viewerUserId) {
  if (!viewerUserId || candidates.length === 0) {
    return candidates.map((u) => ({
      ...u,
      connectionStatus: "none",
      connectionId: null,
      connectsCount: 0,
    }));
  }

  const candidateIds = candidates.map((u) => u.userId);

  const [viewerConnectedIds, relevantDocs, candidateConnectedSets] = await Promise.all([
    getConnectedIds(viewerUserId),
    Connection.find({
      $or: [
        { requester: viewerUserId, recipient: { $in: candidateIds } },
        { requester: { $in: candidateIds }, recipient: viewerUserId },
      ],
    }),
    Promise.all(candidates.map((u) => getConnectedIds(u.userId))),
  ]);

  const docByCandidate = new Map();
  relevantDocs.forEach((d) => {
    const otherId = d.requester === viewerUserId ? d.recipient : d.requester;
    docByCandidate.set(otherId, d);
  });

  return candidates.map((u, i) => {
    const doc = docByCandidate.get(u.userId);
    let connectionStatus = "none";
    if (doc) {
      if (doc.status === "accepted") connectionStatus = "connected";
      else if (doc.status === "pending") {
        connectionStatus = doc.requester === viewerUserId ? "pending_sent" : "pending_received";
      }
    }

    let connectsCount = 0;
    for (const id of candidateConnectedSets[i]) {
      if (viewerConnectedIds.has(id)) connectsCount++;
    }

    return { ...u, connectionStatus, connectionId: doc?.connectionId ?? null, connectsCount };
  });
}

// ─────────────────────────────────────────
// "People you may know" — GET /connections/discover?page=&limit=
// Excludes self and anyone already connected/pending with the viewer.
// ─────────────────────────────────────────
exports.getDiscoverUsers = async (req, res) => {
  try {
    const { userId } = req.user;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 30);
    const skip = (page - 1) * limit;

    const existingDocs = await Connection.find({
      $or: [{ requester: userId }, { recipient: userId }],
    });
    const excludeIds = new Set([
      userId,
      ...existingDocs.map((d) => (d.requester === userId ? d.recipient : d.requester)),
    ]);

    // Fetch one extra record beyond `limit` to know whether a next page
    // exists, instead of a separate countDocuments() call. If we get back
    // limit+1 rows, there's more; we then trim to `limit` before responding.
    // const users = await User.find({ userId: { $nin: [...excludeIds] } })
    //   .sort({ createdAt: -1 })
    //   .skip(skip)
    //   .limit(limit + 1);

    const users = await User.find({
      userId: { $ne: userId },
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit + 1);
    const hasNext = users.length > limit;
    const pageUsers = users.slice(0, limit).map(toPublicUser);
    const withInfo = await attachConnectionInfo(pageUsers, userId);

    res.status(200).json({
      success: true,
      users: withInfo,
      page,
      limit,
      hasNext,
      hasPrevious: page > 1,
    });
  } catch (error) {
    console.error("getDiscoverUsers error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─────────────────────────────────────────
// Search — GET /connections/search?q=&page=&limit=
// ─────────────────────────────────────────
exports.searchUsers = async (req, res) => {
  try {
    const { userId } = req.user;
    const q = (req.query.q || "").trim();
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 30);
    const skip = (page - 1) * limit;

    if (!q) {
      return res.status(200).json({
        success: true,
        users: [],
        page,
        limit,
        hasNext: false,
        hasPrevious: false,
      });
    }

    const filter = {
      userId: { $ne: userId },
      $or: [{ name: { $regex: q, $options: "i" } }, { role: { $regex: q, $options: "i" } }],
    };

    const users = await User.find(filter)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit + 1);

    const hasNext = users.length > limit;
    const pageUsers = users.slice(0, limit).map(toPublicUser);
    const withInfo = await attachConnectionInfo(pageUsers, userId);

    res.status(200).json({
      success: true,
      users: withInfo,
      page,
      limit,
      hasNext,
      hasPrevious: page > 1,
    });
  } catch (error) {
    console.error("searchUsers error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.searchMyConnections = async (req, res) => {
  try {
    const { userId } = req.user;
    const q = (req.query.q || "").trim();

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 30);
    const skip = (page - 1) * limit;

    // Get all accepted connections
    const docs = await Connection.find({
      status: "accepted",
      $or: [
        { requester: userId },
        { recipient: userId },
      ],
    });

    const connectedIds = docs.map((d) =>
      d.requester === userId ? d.recipient : d.requester
    );

    const filter = {
      userId: { $in: connectedIds },
    };

    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { role: { $regex: q, $options: "i" } },
      ];
    }

    const users = await User.find(filter)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit + 1);

    const hasNext = users.length > limit;

    const pageUsers = users.slice(0, limit).map((u) => {
      const connection = docs.find(
        (d) =>
          (d.requester === u.userId && d.recipient === userId) ||
          (d.requester === userId && d.recipient === u.userId)
      );

      return {
        ...toPublicUser(u),
        connectionStatus: "connected",
        connectionId: connection?.connectionId,
      };
    });

    res.status(200).json({
      success: true,
      users: pageUsers,
      page,
      limit,
      hasNext,
      hasPrevious: page > 1,
    });
  } catch (error) {
    console.error("searchMyConnections error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ─────────────────────────────────────────
// My accepted connections — GET /connections?page=&limit=
// (the "Connected accounts" screen)
// ─────────────────────────────────────────
exports.getMyConnections = async (req, res) => {
  try {
    const { userId } = req.user;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 30);
    const skip = (page - 1) * limit;

    const docs = await Connection.find({
      status: "accepted",
      $or: [{ requester: userId }, { recipient: userId }],
    })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit + 1);

    const hasNext = docs.length > limit;
    const pageDocs = docs.slice(0, limit);
    const otherIds = pageDocs.map((d) => (d.requester === userId ? d.recipient : d.requester));

    const users = await User.find({ userId: { $in: otherIds } });
    const userMap = new Map(users.map((u) => [u.userId, toPublicUser(u)]));

    const withInfo = pageDocs
      .map((d) => {
        const otherId = d.requester === userId ? d.recipient : d.requester;
        const u = userMap.get(otherId);
        if (!u) return null;
        return { ...u, connectionStatus: "connected", connectionId: d.connectionId };
      })
      .filter(Boolean);

    res.status(200).json({
      success: true,
      users: withInfo,
      page,
      limit,
      hasNext,
      hasPrevious: page > 1,
    });
  } catch (error) {
    console.error("getMyConnections error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─────────────────────────────────────────
// Requests waiting on YOU to respond — GET /connections/requests?page=&limit=
// (pending connection requests where you're the recipient)
// ─────────────────────────────────────────
exports.getPendingRequests = async (req, res) => {
  try {
    const { userId } = req.user;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
    const skip = (page - 1) * limit;

    const docs = await Connection.find({ recipient: userId, status: "pending" })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit + 1);

    const hasNext = docs.length > limit;
    const pageDocs = docs.slice(0, limit);

    const requesterIds = pageDocs.map((d) => d.requester);
    const users = await User.find({ userId: { $in: requesterIds } });
    const userMap = new Map(users.map((u) => [u.userId, toPublicUser(u)]));

    const requests = pageDocs
      .map((d) => {
        const u = userMap.get(d.requester);
        if (!u) return null;
        return { connectionId: d.connectionId, requestedAt: d.createdAt, ...u };
      })
      .filter(Boolean);

    res.status(200).json({
      success: true,
      requests,
      page,
      limit,
      hasNext,
      hasPrevious: page > 1,
    });
  } catch (error) {
    console.error("getPendingRequests error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─────────────────────────────────────────
// Send a connect request — POST /connections/request
// Body: { toUserId }
// ─────────────────────────────────────────
exports.sendConnectRequest = async (req, res) => {
  try {
    const { userId } = req.user;
    const { toUserId } = req.body;

    if (!toUserId) {
      return res.status(400).json({ success: false, message: "toUserId is required" });
    }
    if (toUserId === userId) {
      return res.status(400).json({ success: false, message: "You can't connect with yourself" });
    }

    const recipient = await User.findOne({ userId: toUserId });
    if (!recipient) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const existing = await Connection.findOne({
      $or: [
        { requester: userId, recipient: toUserId },
        { requester: toUserId, recipient: userId },
      ],
    });

    if (existing) {
      if (existing.status === "accepted") {
        return res.status(400).json({ success: false, message: "Already connected" });
      }
      if (existing.status === "pending") {
        return res.status(400).json({ success: false, message: "Connection request already pending" });
      }
      // Previously declined — allow re-sending by resetting it to pending.
      existing.status = "pending";
      existing.requester = userId;
      existing.recipient = toUserId;
      await existing.save();

      broadcastAll({
        type: "connection_request",
        connectionId: existing.connectionId,
        from: userId,
        to: toUserId,
      });

      return res.status(200).json({
        success: true,
        message: "Connection request sent",
        connectionId: existing.connectionId,
        connectionStatus: "pending_sent",
      });
    }

    const connection = await Connection.create({
      connectionId: uuidv4(),
      requester: userId,
      recipient: toUserId,
      status: "pending",
    });

    // Broadcast is a coarse "notify everyone connected" like the rest of
    // the app's REST controllers use for Post events. If you want this
    // targeted only at the recipient, wire it through userSockets instead
    // (needs the recipient's socket "code", which is a separate identifier
    // from userId in this codebase's chat system).
    broadcastAll({
      type: "connection_request",
      connectionId: connection.connectionId,
      from: userId,
      to: toUserId,
    });

    res.status(201).json({
      success: true,
      message: "Connection request sent",
      connectionId: connection.connectionId,
      connectionStatus: "pending_sent",
    });
  } catch (error) {
    console.error("sendConnectRequest error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─────────────────────────────────────────
// Accept / decline a pending request — POST /connections/:connectionId/respond
// Body: { accept: boolean }
// ─────────────────────────────────────────
exports.respondToConnectRequest = async (req, res) => {
  try {
    const { userId } = req.user;
    const { connectionId } = req.params;
    const { accept } = req.body;

    const connection = await Connection.findOne({ connectionId });
    if (!connection) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }
    if (connection.recipient !== userId) {
      return res.status(403).json({ success: false, message: "Not your request to respond to" });
    }
    if (connection.status !== "pending") {
      return res.status(400).json({ success: false, message: "Request already handled" });
    }

    connection.status = accept ? "accepted" : "declined";
    await connection.save();

    broadcastAll({
      type: "connection_response",
      connectionId,
      accepted: !!accept,
      by: userId,
      requester: connection.requester,
    });

    res.status(200).json({
      success: true,
      message: accept ? "Connection accepted" : "Connection declined",
      connectionStatus: accept ? "connected" : "none",
    });
  } catch (error) {
    console.error("respondToConnectRequest error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─────────────────────────────────────────
// Remove a connection or cancel a pending request — DELETE /connections/:connectionId
// ─────────────────────────────────────────
exports.removeConnection = async (req, res) => {
  try {
    const { userId } = req.user;
    const { connectionId } = req.params;

    const connection = await Connection.findOne({ connectionId });
    if (!connection) {
      return res.status(404).json({ success: false, message: "Connection not found" });
    }
    if (connection.requester !== userId && connection.recipient !== userId) {
      return res.status(403).json({ success: false, message: "Not part of this connection" });
    }

    await connection.deleteOne();

    res.status(200).json({ success: true, message: "Connection removed" });
  } catch (error) {
    console.error("removeConnection error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};