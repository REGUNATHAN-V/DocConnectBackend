// handlers/forwardMessage.js
// Uses ForwardedMessage table for full audit trail.
// Chat table only gets a lightweight isForwarded flag.

const { userSockets }    = require("../socketState");
const Chat               = require("../../models/Chat");
const ForwardedMessage   = require("../../models/ForwardedMessage");
const DeletedMessage     = require("../../models/DeletedMessage");
const Token              = require("../../models/FcmToken");
const admin              = require("../../services/firebaseService");

// ─────────────────────────────────────────────────────────────────────────────
//  forward_message
//
//  { type: "forward_message", messageId, forwardedBy, forwardedByName,
//    receivers: [{ userId, userName }, …] }
// ─────────────────────────────────────────────────────────────────────────────
async function handleForwardMessage(ws, parsed) {
  const { messageId, forwardedBy, forwardedByName, receivers } = parsed;

  if (!messageId || !forwardedBy || !Array.isArray(receivers) || receivers.length === 0) {
    return ws.send(JSON.stringify({ type: "error", message: "Invalid forward payload" }));
  }

  try {
    // 1. Load source message
    const source = await Chat.findById(messageId);
    if (!source) return ws.send(JSON.stringify({ type: "error", message: "Message not found" }));

    // Block if deleted for everyone
    const deletedForAll = await DeletedMessage.findOne({
      messageId, deleteType: "for_everyone",
    });
    if (deletedForAll) {
      return ws.send(JSON.stringify({ type: "error", message: "Cannot forward a deleted message" }));
    }

    // Resolve true original (handles re-forwarding)
    const trueOriginalId     = source.originalMessageId || source._id;
    const trueOriginalSender = source.originalSender    || source.sender;

    // Resolve hop number (how deep is this forward chain?)
    const existingHops = await ForwardedMessage.countDocuments({ originalMessageId: trueOriginalId });
    const hopNumber    = existingHops + 1;

    const forwardedMsgIds = [];

    // 2. For each receiver
    for (const recv of receivers) {
      // 2a. Clone Chat document
      const newMsg = new Chat({
        sender:       forwardedBy,
        receiver:     recv.userId,
        senderName:   forwardedByName,
        receiverName: recv.userName,
        message:      source.message,
        messageType:  source.messageType,
        timestamp:    Date.now(),
        status:       "sent",
        // voice
        audioUrl: source.audioUrl,
        audioId:  source.audioId,
        duration: source.duration,
        // file
        fileUrl:      source.fileUrl,
        fileKey:      source.fileKey,
        fileName:     source.fileName,
        fileSize:     source.fileSize,
        fileMimeType: source.fileMimeType,
        // location
        latitude:  source.latitude,
        longitude: source.longitude,
        address:   source.address,
        // contact
        contactName:  source.contactName,
        contactPhone: source.contactPhone,
        // forward flags
        isForwarded:       true,
        originalMessageId: trueOriginalId,
        originalSender:    trueOriginalSender,
      });
      await newMsg.save();
      forwardedMsgIds.push(newMsg._id);

      // 2b. Record hop in ForwardedMessage table
      await ForwardedMessage.create({
        sourceMessageId:    source._id,
        originalMessageId:  trueOriginalId,
        originalSender:     trueOriginalSender,
        forwardedBy,
        forwardedByName,
        forwardedTo:        recv.userId,
        forwardedToName:    recv.userName,
        forwardedMessageId: newMsg._id,
        forwardedAt:        Date.now(),
        hopNumber,
      });

      // 2c. Deliver
      const receiverSocket = userSockets.get(recv.userId);
      const payload = JSON.stringify({
        type:         "private_message",
        id:           newMsg._id,
        sender:       newMsg.sender,
        receiver:     newMsg.receiver,
        senderName:   newMsg.senderName,
        receiverName: newMsg.receiverName,
        message:      newMsg.message,
        messageType:  newMsg.messageType,
        timestamp:    newMsg.timestamp,
        isForwarded:  true,
        originalSender: trueOriginalSender,
        // attachments
        audioUrl:    newMsg.audioUrl,
        duration:    newMsg.duration,
        fileUrl:     newMsg.fileUrl,
        fileName:    newMsg.fileName,
        fileSize:    newMsg.fileSize,
        fileMimeType:newMsg.fileMimeType,
        latitude:    newMsg.latitude,
        longitude:   newMsg.longitude,
        address:     newMsg.address,
        contactName: newMsg.contactName,
        contactPhone:newMsg.contactPhone,
      });

      if (receiverSocket?.readyState === 1) {
        receiverSocket.send(payload);
        newMsg.status      = "delivered";
        newMsg.deliveredAt = Date.now();
        await newMsg.save();

        ws.send(JSON.stringify({
          type: "delivered_ack", messageId: newMsg._id,
          sender: forwardedBy, receiver: recv.userId,
          timestamp: newMsg.deliveredAt,
        }));
      } else {
        // FCM fallback
        const tokenDoc = await Token.findOne({ userId: recv.userId, isActive: true });
        if (tokenDoc?.token) {
          try {
            await admin.messaging().send({
              token: tokenDoc.token,
              notification: {
                title: `Forwarded message from ${forwardedByName}`,
                body:  newMsg.message || `[${newMsg.messageType}]`,
              },
              data: { type: "forwarded_message", sender: forwardedBy,
                      receiver: recv.userId, messageId: String(newMsg._id) },
              android: { priority: "high" },
            });
          } catch (err) {
            console.error(`❌ FCM forward error for ${recv.userId}:`, err.message);
          }
        }
      }
    }

    // 3. ACK forwarder
    const totalForwards = await ForwardedMessage.countDocuments({ originalMessageId: trueOriginalId });
    ws.send(JSON.stringify({
      type:             "forward_ack",
      originalMsgId:    messageId,
      forwardedTo:      receivers.map((r) => r.userId),
      forwardedMsgIds,
      totalForwardCount: totalForwards,
    }));

  } catch (err) {
    console.error("❌ handleForwardMessage:", err.message);
    ws.send(JSON.stringify({ type: "error", message: "Forward failed: " + err.message }));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  get_forward_info
//  { type: "get_forward_info", messageId }
//  Returns full trail + count from ForwardedMessage table
// ─────────────────────────────────────────────────────────────────────────────
async function handleGetForwardInfo(ws, parsed) {
  const { messageId } = parsed;
  try {
    const chat = await Chat.findById(messageId)
      .select("isForwarded originalMessageId originalSender sender");
    if (!chat) return ws.send(JSON.stringify({ type: "error", message: "Message not found" }));

    const originalId = chat.originalMessageId || chat._id;

    const trail = await ForwardedMessage
      .find({ originalMessageId: originalId })
      .sort({ forwardedAt: 1 })
      .select("forwardedBy forwardedByName forwardedTo forwardedToName forwardedAt hopNumber");

    ws.send(JSON.stringify({
      type:           "forward_info",
      messageId:      chat._id,
      isForwarded:    chat.isForwarded,
      originalSender: chat.originalSender || chat.sender,
      originalMsgId:  originalId,
      totalForwards:  trail.length,
      trail,          // full hop-by-hop audit log
    }));
  } catch (err) {
    console.error("❌ handleGetForwardInfo:", err.message);
  }
}

module.exports = { handleForwardMessage, handleGetForwardInfo };