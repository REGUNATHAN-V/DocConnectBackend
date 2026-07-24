const { userSockets } = require("../socketState");
const Chat = require("../../models/Chat");
const Token = require("../../models/FcmToken");
const admin = require("../../services/firebaseService");
const CodeConnected = require("../../models/CodeConnected");
const UserBlock = require("../../models/UserBlock");

async function handlePrivateMessage(ws, parsed) {
  const { sender, senderName, receiver, receiverName, message, tempId } = parsed;

  // ── Block check ───────────────────────────────────────────────────────────
  const block = await UserBlock.findOne({
    $or: [
      { blockerId: sender,   blockedId: receiver },
      { blockerId: receiver, blockedId: sender   },
    ]
  });

  if (block) {
    // Silently reject — or optionally notify sender
    const senderSocket = userSockets.get(sender);
    if (senderSocket?.readyState === 1) {
      senderSocket.send(JSON.stringify({
        type:    "message_blocked",
        tempId,
        reason:  "blocked",
      }));
    }
    return; // stop processing
  }

  console.log("parsed--->",parsed)

  // Save to DB
  const chat = new Chat({
    sender, receiver, senderName, receiverName,
    message, timestamp: Date.now(), status: "sent", messageType: "chat",
  });
  await chat.save();

  // ACK sender with real ID
  const senderSocket = userSockets.get(sender);
  if (senderSocket?.readyState === 1) {
    senderSocket.send(JSON.stringify({
      type: "update_private_messageid",
      tempId, messageId: chat._id,
      timestamp: chat.timestamp, status: "sent",
    }));
  }

  // Deliver to receiver
  const receiverSocket = userSockets.get(receiver);
  if (receiverSocket?.readyState === 1) {
    receiverSocket.send(JSON.stringify({
      type: "private_message",
      id: chat._id, sender, receiver, senderName, receiverName,
      message, timestamp: chat.timestamp, messageType: chat.messageType,
    }));

    chat.status = "delivered";
    chat.deliveredAt = Date.now();
    await chat.save();

    if (senderSocket?.readyState === 1) {
      senderSocket.send(JSON.stringify({
        type: "delivered_ack",
        messageId: chat._id, sender, receiver, timestamp: chat.deliveredAt,
      }));
    }
  }
  // else {
  //   // Push notification for offline receiver
  //   const tokenDoc = await Token.findOne({ userId: receiver,isActive:true });
  //   if (tokenDoc?.token) {
  //     try {
  //       console.log(`🔔 Sending FCM for ${receiver}`);
  //       await admin.messaging().send({
  //         token: tokenDoc.token,
  //         // notification: { title: `New message from ${sender}`, body: message },
  //         data: { type: "chat_message_reply", sender, receiver, message, messageId: String(chat._id) },
  //         android: { priority: "high" },
  //       });
  //     } catch (err) {
  //       console.error(`❌ FCM Error for ${receiver}: ${err.message}`);
  //     }
  //   }
  // }

  const tokenDoc = await Token.findOne({ userId: receiver,isActive:true });
  const codeConnected = await CodeConnected.findOne({code:receiver})
  console.log(codeConnected);
  if (tokenDoc?.token && codeConnected.notify) {
    try {
      console.log(`🔔 Sending FCM for ${receiver}`);
      await admin.messaging().send({
        token: tokenDoc.token,
        // notification: { title: `New message from ${sender}`, body: message },
        data: { type: "chat_message_reply", sender, receiver, senderName, message, messageId: String(chat._id) },
        android: { priority: "high" },
      });
    } catch (err) {
      console.error(`❌ FCM Error for ${receiver}: ${err.message}`);
    }
  }
}

module.exports = { handlePrivateMessage };