const Chat = require("../models/Chat");
const DeletedMessage = require("../models/DeletedMessage");
const User = require("../models/User");

function buildPreview(msg) {
  if (msg.deletedForEveryone) return "🚫 This message was deleted";
  switch (msg.messageType) {
    case "voice":
    case "audio": return "🎤 Voice message";
    case "image": return "📷 Photo";
    case "video": return "🎬 Video";
    case "document": return `📄 ${msg.fileName || "Document"}`;
    case "location": return "📍 Location";
    case "contact": return "📇 Contact";
    default: return msg.message || "";
  }
}


exports.getChatHistory = async (req, res) => {
  try {
    const { userId } = req.user;
    const withCode = req.query.with;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const skip = (page - 1) * limit;

    if (!withCode) {
      return res.status(400).json({ success: false, message: "'with' query param is required" });
    }

    const deletedForMeIds = await DeletedMessage.find({
      deleteType: "for_me",
      deletedBy: userId,
    }).distinct("messageId");

    const query = {
      $or: [
        { sender: userId, receiver: withCode },
        { sender: withCode, receiver: userId },
      ],
      _id: { $nin: deletedForMeIds },
    };

    const total = await Chat.countDocuments(query);

    const docs = await Chat.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    const messages = docs.reverse();

    res.status(200).json({
      success: true,
      messages,
      page,
      limit,
      hasMore: skip + docs.length < total,
    });
  } catch (error) {
    console.error("getChatHistory error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


exports.getConversations = async (req, res) => {
  try {
    const { userId } = req.user;

    const deletedForMeIds = await DeletedMessage.find({
      deleteType: "for_me",
      deletedBy: userId,
    }).distinct("messageId");
    const deletedSet = new Set(deletedForMeIds.map(String));

 
    const messages = await Chat.find({
      $or: [{ sender: userId }, { receiver: userId }],
    })
      .sort({ timestamp: -1 })
      .limit(3000);

    const seenPartners = new Set();
    const lastMessageByPartner = [];

    for (const m of messages) {
      if (deletedSet.has(String(m._id))) continue;
      const otherCode = m.sender === userId ? m.receiver : m.sender;
      if (seenPartners.has(otherCode)) continue;
      seenPartners.add(otherCode);
      lastMessageByPartner.push({
        code: otherCode,
        lastMessage: buildPreview(m),
        lastMessageAt: m.timestamp,
        lastMessageSender: m.sender,
        lastMessageType: m.messageType,
      });
    }

    if (lastMessageByPartner.length === 0) {
      return res.status(200).json({ success: true, conversations: [] });
    }

    const otherCodes = lastMessageByPartner.map((c) => c.code);

    const [users, unreadAgg] = await Promise.all([
      User.find({ userId: { $in: otherCodes } }).select("userId name role profilePic"),
      Chat.aggregate([
        {
          $match: {
            receiver: userId,
            sender: { $in: otherCodes },
            status: { $ne: "seen" },
            deletedForEveryone: { $ne: true },
          },
        },
        { $group: { _id: "$sender", count: { $sum: 1 } } },
      ]),
    ]);

    const userMap = new Map(users.map((u) => [u.userId, u]));
    const unreadMap = new Map(unreadAgg.map((u) => [u._id, u.count]));

    const conversations = lastMessageByPartner
      .map((c) => {
        const u = userMap.get(c.code);
        return {
          code: c.code,
          name: u?.name || c.code,
          subtitle: u?.role || "",
          profilePic: u?.profilePic || null,
          lastMessage: c.lastMessage,
          lastMessageAt: c.lastMessageAt,
          lastMessageSender: c.lastMessageSender,
          unreadCount: unreadMap.get(c.code) || 0,
        };
      })
      .sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));

    res.status(200).json({ success: true, conversations });
  } catch (error) {
    console.error("getConversations error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};