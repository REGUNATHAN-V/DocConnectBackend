// handlers/messageActions.js
// star_message | unstar_message | get_starred_messages
// delete_for_me | delete_for_everyone
// All state lives in StarredMessage / DeletedMessage tables — Chat stays clean.

const { userSockets }    = require("../socketState");
const Chat               = require("../../models/Chat");
const StarredMessage     = require("../../models/StarredMessage");
const DeletedMessage     = require("../../models/DeletedMessage");
const Token = require("../../models/FcmToken");
const PendingDelete = require("../../models/PendingDelete");
const admin = require("../../services/firebaseService");
const CodeConnected = require("../../models/CodeConnected");


// ─────────────────────────────────────────────────────────────────────────────
//  ★  STAR
//  { type: "star_message", messageId, userId }
// ─────────────────────────────────────────────────────────────────────────────
async function handleStarMessage(ws, parsed) {
  const { messageId, userId } = parsed;
  try {
    const chat = await Chat.findById(messageId);
    if (!chat) return _err(ws, "Message not found");

    // upsert — safe if already starred
    await StarredMessage.findOneAndUpdate(
      { userId, messageId },
      {
        userId, messageId,
        // sender:      chat.sender,
        // receiver:    chat.receiver,
        // message:     chat.message,
        // messageType: chat.messageType,
        // audioUrl:    chat.audioUrl,
        // fileUrl:     chat.fileUrl,
        // fileName:    chat.fileName,
        timestamp:   chat.timestamp,
        starredAt:   Date.now(),
      },
      { upsert: true, new: true }
    );

    ws.send(JSON.stringify({ type: "star_ack", messageId, userId, starred: true }));
  } catch (err) {
    console.error("❌ handleStarMessage:", err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  ★  UNSTAR
//  { type: "unstar_message", messageId, userId }
// ─────────────────────────────────────────────────────────────────────────────
async function handleUnstarMessage(ws, parsed) {
  const { messageId, userId } = parsed;
  try {
    await StarredMessage.deleteOne({ userId, messageId });
    ws.send(JSON.stringify({ type: "star_ack", messageId, userId, starred: false }));
  } catch (err) {
    console.error("❌ handleUnstarMessage:", err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  ★  GET ALL STARRED
//  { type: "get_starred_messages", userId }
// ─────────────────────────────────────────────────────────────────────────────
async function handleGetStarredMessages(ws, parsed) {
  const { userId } = parsed;
  try {
    // Exclude messages that were later deleted for everyone
    const starred = await StarredMessage.find({ userId })
      .sort({ starredAt: -1 });

    // Filter out any that have since been deleted for everyone
    const messageIds = starred.map((s) => s.messageId);
    const deletedForAll = await DeletedMessage.find({
      messageId:  { $in: messageIds },
      deleteType: "for_everyone",
    }).distinct("messageId");

    const deletedSet = new Set(deletedForAll.map(String));
    const visible    = starred.filter((s) => !deletedSet.has(String(s.messageId)));

    ws.send(JSON.stringify({ type: "starred_messages", messages: visible }));
  } catch (err) {
    console.error("❌ handleGetStarredMessages:", err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  🗑  DELETE FOR ME
//  { type: "delete_for_me", messageId, userId }
// ─────────────────────────────────────────────────────────────────────────────
async function handleDeleteForMe(ws, parsed) {
  const { messageId, userId } = parsed;
  try {
    const chat = await Chat.findById(messageId);
    if (!chat) return _err(ws, "Message not found");

    console.log("chat.sender-->",chat.sender, "userId-->",userId);

    await DeletedMessage.findOneAndUpdate(
      { messageId, deleteType: "for_me", deletedBy: userId },
      { messageId, deleteType: "for_me", deletedBy: userId,
        deletedAt: Date.now(), sender: chat.sender, receiver: chat.receiver },
      { upsert: true }
    );

    // Also remove from that user's starred list silently
    await StarredMessage.deleteOne({ userId, messageId });

    

    if (ws?.readyState === 1) {
      ws.send(JSON.stringify({ type: "delete_for_me_ack", messageId, userId }));
    }else {
      await PendingDelete.create({
        messageId,
        sender: userId,
        receiver: userId, 
        deleteType: "delete_for_me_ack",
        deletedAt: Date.now(),
      });
    }
  } catch (err) {
    console.error("❌ handleDeleteForMe:", err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  🗑  DELETE FOR EVERYONE
//  { type: "delete_for_everyone", messageId, userId }
//  Only the original sender may call this.
// ─────────────────────────────────────────────────────────────────────────────
async function handleDeleteForEveryone(ws, parsed) {
  const { messageId, userId } = parsed;
  try {
    const chat = await Chat.findById(messageId);
    if (!chat)             return _err(ws, "Message not found");
    console.log("chat.sender-->",chat.sender, "userId-->",userId);
    if (chat.sender !== userId) return _err(ws, "Only the sender can delete for everyone");

    // 1. Record in DeletedMessage table
    await DeletedMessage.findOneAndUpdate(
      { messageId, deleteType: "for_everyone" },
      { messageId, deleteType: "for_everyone", deletedBy: userId,
        deletedAt: Date.now(), sender: chat.sender, receiver: chat.receiver },
      { upsert: true }
    );

    // 2. Wipe content on Chat document
    chat.deletedForEveryone = true;
    chat.deletedAt          = Date.now();
    // chat.message            = "";
    chat.audioUrl           = undefined;
    chat.fileUrl            = undefined;
    await chat.save();

    // 3. Remove from ALL users' starred lists for this message
    await StarredMessage.deleteMany({ messageId });

    const payload = JSON.stringify({
      type: "delete_for_everyone_ack",
      messageId, sender: chat.sender, receiver: chat.receiver,
      deletedAt: chat.deletedAt,
    });

    ws.send(payload);

    const receiverSocket = userSockets.get(chat.receiver);
    if (receiverSocket?.readyState === 1) {
        receiverSocket.send(payload);
      } else {
        const sender = chat.sender;      
        const receiver = chat.receiver; 
      
        await PendingDelete.create({
          messageId,
          deleteType:"delete_for_everyone_ack",
          sender,
          receiver,
          deletedAt: chat.deletedAt,
        });
      
        const tokenDoc = await Token.findOne({ userId: receiver, isActive: true }); 
        const codeConnected = await CodeConnected.findOne({code:receiver})


        console.log("tokenDoc-->",tokenDoc)
        if (tokenDoc?.token && codeConnected.notify) {
          try {
            const message = `Deleted for everyone`;
            await admin.messaging().send({
              token: tokenDoc.token,
              // notification: { title: `New message from ${sender}`, body: message },
              data: { type: "delete_for_everyone", sender, receiver, messageId: String(chat._id) },
              android: { priority: "high" },
            });
          } catch (err) {
            console.error(`❌ FCM Error for ${receiver}: ${err.message}`);
          }
        }
      }

   

  } catch (err) {
    console.error("❌ handleDeleteForEveryone:", err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────
function _err(ws, message) {
  ws.send(JSON.stringify({ type: "error", message }));
}

module.exports = {
  handleStarMessage,
  handleUnstarMessage,
  handleGetStarredMessages,
  handleDeleteForMe,
  handleDeleteForEveryone,
};