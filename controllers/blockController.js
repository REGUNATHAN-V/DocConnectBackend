// controllers/blockController.js
const User = require("../models/User");
const UserBlock = require("../models/UserBlock");

// Block a user
exports.blockUser = async (req, res) => {
  try {
    const blockerId = req.user.userId;
    const { blockedId } = req.body;

    if (!blockedId) {
      return res.status(400).json({ success: false, message: "blockedId is required" });
    }
    if (blockerId === blockedId) {
      return res.status(400).json({ success: false, message: "You cannot block yourself" });
    }

    await UserBlock.findOneAndUpdate(
      { blockerId, blockedId },
      { blockerId, blockedId },
      { upsert: true, new: true }
    );

    res.status(200).json({ success: true, message: "User blocked successfully" });
  } catch (error) {
    console.error("blockUser error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Unblock a user
exports.unblockUser = async (req, res) => {
  try {
    const blockerId = req.user.userId;
    const { blockedId } = req.params;

    await UserBlock.findOneAndDelete({ blockerId, blockedId });

    res.status(200).json({ success: true, message: "User unblocked successfully" });
  } catch (error) {
    console.error("unblockUser error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Check if blocked (either direction)
exports.checkBlockStatus = async (req, res) => {
  try {
    const myId = req.user.userId;
    const { otherId } = req.params;

    const iBlockedThem = await UserBlock.findOne({ blockerId: myId,  blockedId: otherId });
    const theyBlockedMe = await UserBlock.findOne({ blockerId: otherId, blockedId: myId });

    res.status(200).json({
      success:      true,
      iBlockedThem:  !!iBlockedThem,
      theyBlockedMe: !!theyBlockedMe,
      isBlocked:     !!(iBlockedThem || theyBlockedMe),
    });
  } catch (error) {
    console.error("checkBlockStatus error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get my blocked list
exports.getBlockedUsers = async (req, res) => {
    try {
      const blockerId = req.user.userId;
      const blocks = await UserBlock.find({ blockerId });
  
      // Fetch user details for each blocked userId
      const blockedUsers = await Promise.all(
        blocks.map(async (block) => {
          const user = await User.findOne({ userId: block.blockedId })
            .select("userId name profilePic");
          return {
            userId    : block.blockedId,
            name      : user?.name       || block.blockedId,
            profilePic: user?.profilePic || "",
          };
        })
      );
  
      res.status(200).json({
        success     : true,
        blockedIds  : blockedUsers.map(u => u.userId),  // keep old field so nothing breaks
        blockedUsers,                                    // new field with full details
      });
    } catch (error) {
      console.error("getBlockedUsers error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  };

  // admin
  // ── Admin: get ALL blocks across all users ────────────────────────────────
exports.adminGetAllBlocks = async (req, res) => {
    try {
      const blocks = await UserBlock.find();
  
      const enriched = await Promise.all(
        blocks.map(async (block) => {
          const [blocker, blocked] = await Promise.all([
            User.findOne({ userId: block.blockerId }).select("userId name profilePic"),
            User.findOne({ userId: block.blockedId }).select("userId name profilePic"),
          ]);
          return {
            _id        : block._id,
            blocker    : {
              userId    : block.blockerId,
              name      : blocker?.name       || block.blockerId,
              profilePic: blocker?.profilePic || "",
            },
            blocked    : {
              userId    : block.blockedId,
              name      : blocked?.name       || block.blockedId,
              profilePic: blocked?.profilePic || "",
            },
            createdAt  : block.createdAt,
          };
        })
      );
  
      res.status(200).json({
        success: true,
        total  : enriched.length,
        blocks : enriched,
      });
    } catch (error) {
      console.error("adminGetAllBlocks error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  };
  
  // ── Admin: force-unblock any user ─────────────────────────────────────────
  exports.adminUnblockUser = async (req, res) => {
    try {
      const { blockerId, blockedId } = req.body;
  
      if (!blockerId || !blockedId) {
        return res.status(400).json({
          success: false,
          message: "blockerId and blockedId are required",
        });
      }
  
      const result = await UserBlock.findOneAndDelete({ blockerId, blockedId });
  
      if (!result) {
        return res.status(404).json({
          success: false,
          message: "Block record not found",
        });
      }
  
      res.status(200).json({
        success: true,
        message: `Successfully unblocked`,
      });
    } catch (error) {
      console.error("adminUnblockUser error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  };
  
  // ── Admin: get all blocks FOR a specific user (who they blocked + who blocked them) ──
  exports.adminGetUserBlocks = async (req, res) => {
    try {
      const { userId } = req.params;
  
      const [blockedByUser, blockedByOthers] = await Promise.all([
        UserBlock.find({ blockerId: userId }),  // users this person blocked
        UserBlock.find({ blockedId: userId }),  // users who blocked this person
      ]);
  
      const enrichUsers = async (list, keyField) =>
        Promise.all(
          list.map(async (block) => {
            const uid  = block[keyField];
            const user = await User.findOne({ userId: uid }).select("userId name profilePic");
            return {
              userId    : uid,
              name      : user?.name       || uid,
              profilePic: user?.profilePic || "",
              createdAt : block.createdAt,
            };
          })
        );
  
      const [theyBlocked, blockedThem] = await Promise.all([
        enrichUsers(blockedByUser,   "blockedId"),   // people this user blocked
        enrichUsers(blockedByOthers, "blockerId"),   // people who blocked this user
      ]);
  
      res.status(200).json({
        success    : true,
        userId,
        theyBlocked,       // this user blocked these people
        blockedThem,       // these people blocked this user
      });
    } catch (error) {
      console.error("adminGetUserBlocks error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  };