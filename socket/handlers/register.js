const { userSockets } = require("../socketState");
const codeConnected = require("../../models/CodeConnected");
const Chat = require("../../models/Chat");
const GroupChat = require("../../models/GroupChat");
const Group = require("../../models/Group");
const PendingDelivery = require("../../models/PendingDelivery");
const PendingSeen = require("../../models/PendingSeen");
const PendingGroupSeen = require("../../models/PendingGroupSeen");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const s3Client = require("../../config/s3");
const User = require("../../models/User");
const PendingProfileUpdate = require("../../models/PendingProfileUpdate");
const PendingDelete = require("../../models/PendingDelete");

async function handleRegister(ws, parsed) {
  const { code } = parsed;

  // ── Upsert connection record ──────────────────────────────────────────────
  let user = await codeConnected.findOne({ code });
  if (!user) {
    user = new codeConnected({ code, connected: true,active: isActive, connectedAt: Date.now() });
  } else {
    user.connected = true;
    user.connectedAt = Date.now();
  }
  await user.save();

  ws._code = code;
  userSockets.set(code, ws);

  // ── Deliver pending PRIVATE messages ─────────────────────────────────────
  const pendingMsgs = await Chat.find({ receiver: code, status: "sent" }).sort({ timestamp: 1 });

  for (const msg of pendingMsgs) {
    if (msg.messageType === "chat") {
      ws.send(JSON.stringify({
        type: "private_message",
        id: msg._id, sender: msg.sender, receiver: msg.receiver,
        senderName: msg.senderName, receiverName: msg.receiverName,
        message: msg.message, timestamp: msg.timestamp,
        messageType: msg.messageType,
      }));
      msg.status = "delivered";
      msg.deliveredAt = Date.now();
      await msg.save();
    }

    if (msg.messageType === "voice") {
      // let audioUrl = null;
      try {
        // audioUrl = await getSignedUrl(
        //   s3Client,
        //   new GetObjectCommand({ Bucket: process.env.AWS_BUCKET_NAME, Key: msg.audioId }),
        //   { expiresIn: 60 }
        // );
        const url = `https://${process.env.AWS_BUCKET_NAME}.s3.ap-south-1.amazonaws.com/${s3Data.fileKey}`;
      } catch { console.log("❌ Could not generate audio URL for:", msg.audioId); }

      ws.send(JSON.stringify({
        type: "private_voice",
        id: msg._id, sender: msg.sender, receiver: msg.receiver,
        senderName: msg.senderName, receiverName: msg.receiverName,
        message: msg.message, timestamp: msg.timestamp,
        audioUrl: msg.audioUrl,
        duration: msg.duration, audioId: msg.audioId,
        messageType: msg.messageType,
      }));
      msg.status = "delivered";
      msg.deliveredAt = Date.now();
      await msg.save();
    }

    // new private attachment


    if (["image", "video", "document", "audio"].includes(msg.messageType)) {
      ws.send(JSON.stringify({
        type:         "private_attachment",
        id:           msg._id,
        sender:       msg.sender,
        receiver:     msg.receiver,
        senderName:   msg.senderName,
        receiverName: msg.receiverName,
        message:      msg.message,
        timestamp:    msg.timestamp,
        messageType:  msg.messageType,
        fileUrl:      msg.fileUrl,
        fileKey:      msg.fileKey,
        fileName:     msg.fileName,
        fileSize:     msg.fileSize,
        fileMimeType: msg.fileMimeType,
      }));
      msg.status      = "delivered";
      msg.deliveredAt = Date.now();
      await msg.save();
    }

    if (msg.messageType === "location") {
      ws.send(JSON.stringify({
        type:        "private_location",
        id:          msg._id,
        sender:      msg.sender,
        receiver:    msg.receiver,
        senderName:  msg.senderName,
        receiverName:msg.receiverName,
        message:     msg.message,
        timestamp:   msg.timestamp,
        messageType: "location",
        latitude:    msg.latitude,
        longitude:   msg.longitude,
        address:     msg.address,
      }));
      msg.status      = "delivered";
      msg.deliveredAt = Date.now();
      await msg.save();
    }
 
    if (msg.messageType === "contact") {
      ws.send(JSON.stringify({
        type:        "private_contact",
        id:          msg._id,
        sender:      msg.sender,
        receiver:    msg.receiver,
        senderName:  msg.senderName,
        receiverName:msg.receiverName,
        message:     msg.message,
        timestamp:   msg.timestamp,
        messageType: "contact",
        contactName: msg.contactName,
        contactPhone:msg.contactPhone,
      }));
      msg.status      = "delivered";
      msg.deliveredAt = Date.now();
      await msg.save();
    }

    // Notify original sender (or queue)
    const senderSocket = userSockets.get(msg.sender);
    if (senderSocket?.readyState === 1) {
      senderSocket.send(JSON.stringify({
        type: "delivered_ack",
        messageId: msg._id, sender: msg.sender,
        receiver: msg.receiver, timestamp: msg.deliveredAt,
      }));
    } else {
      await PendingDelivery.create({
        sender: msg.sender, receiver: msg.receiver,
        messageId: msg._id, timestamp: msg.deliveredAt,
      });
    }
  }

  // ── Flush pending delivery ACKs ───────────────────────────────────────────
  const pendingAcks = await PendingDelivery.find({ sender: code });
  for (const ack of pendingAcks) {
    const deliveredName = await User.findOne({userId : ack.deliveredBy });
    if (!ack.groupId) {
      ws.send(JSON.stringify({
        type: "delivered_ack",
        messageId: ack.messageId, sender: ack.sender,
        receiver: ack.receiver, timestamp: ack.timestamp,
      }));
      console.log("TEST 1");
    } else {
      ws.send(JSON.stringify({
        type: "group_delivered_ack",
        groupId: ack.groupId, deliveredTo: ack.deliveredBy,
        deliveredName: deliveredName.name,
        messageIds: [ack.messageId], timestamp: ack.timestamp,
      }));
      console.log("TEST 2");

    }
  }
  await PendingDelivery.deleteMany({ sender: code });

  // ── Flush pending seen ACKs ───────────────────────────────────────────────
  const pendingSeenAcks = await PendingSeen.find({ sender: code });
  for (const ack of pendingSeenAcks) {
    ws.send(JSON.stringify({
      type: "seen_ack",
      messageId: ack.messageIds, sender: ack.sender,
      receiver: ack.receiver, timestamp: ack.timestamp,
    }));
  }
  await PendingSeen.deleteMany({ sender: code });

  // ── Flush pending delete-for-everyone ────────────────────────────────────
  const pendingDeletes = await PendingDelete.find({ receiver: code });
  for (const del of pendingDeletes) {
    ws.send(JSON.stringify({
      type:      del.deleteType,
      messageId: del.messageId,
      sender:    del.sender,
      receiver:  del.receiver,
      deletedAt: del.deletedAt,
    }));
  }
  await PendingDelete.deleteMany({ receiver: code });

  // ── Flush pending GROUP seen ACKs ─────────────────────────────────────────
  const pendingGroupSeenAcks = await PendingGroupSeen.find({ sender: code });
  for (const ack of pendingGroupSeenAcks) {
    ws.send(JSON.stringify({
      type: "group_seen_ack",
      groupId: ack.groupId, seenBy: ack.seenBy,
      seenName: ack.name,
      messageIds: ack.messageIds, timestamp: ack.timestamp,
    }));
  }
  await PendingGroupSeen.deleteMany({ sender: code });

  // ── Flush PendingProfile Updates  ──────────────────────────────────────────
  const pendingProfileUpdates = await PendingProfileUpdate.find({ to: code }); 
  for (const update of pendingProfileUpdates) {
    ws.send(JSON.stringify({
      type: "profile_pic_updated",
      userCode: update.userCode,
      profilePic: update.profilePic,
      timestamp: update.timestamp,
    }));
  }
  await PendingProfileUpdate.deleteMany({ to: code });

  // ── Deliver pending GROUP messages ────────────────────────────────────────
  const groupMemberships = await Group.find({ members: code });
  const groupIds = groupMemberships.map((g) => g.groupId);

  if (groupIds.length > 0) {
    const pendingGroupMsgs = await GroupChat.find({
      groupId: { $in: groupIds },
      "deliveredTo.user": { $ne: code },
    }).sort({ timestamp: 1 });

    for (const msg of pendingGroupMsgs) {
      if (msg.sender === code) continue;

      const groupInfo = await Group.findOne({ groupId: msg.groupId });

      if (msg.messageType === "chat") {
        ws.send(JSON.stringify({
          type: "group_message",
          id: msg._id, groupId: msg.groupId, groupName: groupInfo?.name,
          sender: msg.sender, senderName: msg.senderName,
          message: msg.message, timestamp: msg.timestamp,
        }));
        msg.deliveredTo.push({ user: code, timestamp: Date.now() });
      }

      if (msg.messageType === "voice") {
        let audioUrl = null;
        try {
          // audioUrl = await getSignedUrl(
          //   s3Client,
          //   new GetObjectCommand({ Bucket: process.env.AWS_BUCKET_NAME, Key: msg.audioId }),
          //   { expiresIn: 60 }
          // );
          const url = `https://${process.env.AWS_BUCKET_NAME}.s3.ap-south-1.amazonaws.com/${s3Data.fileKey}`;
        } catch { console.log("❌ Could not generate audio URL for:", msg.audioId); }

        ws.send(JSON.stringify({
          type: "group_voice",
          id: msg._id, groupId: msg.groupId, groupName: groupInfo?.name,
          sender: msg.sender, senderName: msg.senderName,
          
          audioUrl:msg.audioUrl, audioId: msg.audioId, duration: msg.duration,
          timestamp: msg.timestamp,
        }));
        msg.deliveredTo.push({ user: code, timestamp: Date.now() });
      }

      // Check full delivery
      const group = await Group.findOne({ groupId: msg.groupId });
      let members = group.members;
      if (members.length === 1 && members[0].includes(",")) {
        members = members[0].split(",").map((m) => m.trim());
      }
      if (msg.deliveredTo.length >= members.length - 1) msg.status = "delivered";
      await msg.save();

    const deliveredName = await User.findOne({userId : code });



      // Notify original sender
      const sendSock = userSockets.get(msg.sender);
      if (sendSock?.readyState === 1) {
        sendSock.send(JSON.stringify({
          type: "group_delivered_ack",
          groupId: msg.groupId, deliveredTo: code,
          deliveredName: deliveredName.name,
          messageIds: [msg._id], timestamp: Date.now(),
        }));
      } else {
        await PendingDelivery.create({
          sender: msg.sender, groupId: msg.groupId,
          deliveredBy: code, deliveredName:deliveredName.name,messageId: msg._id, timestamp: Date.now(),
        });
      }
    }
  }
}

module.exports = { handleRegister };