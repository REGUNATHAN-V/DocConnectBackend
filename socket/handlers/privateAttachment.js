// handlers/privateAttachment.js
//
// HTTP multipart handler — called from POST /api/chat/send-attachment
// Mirrors privateVoice.js exactly:
//   1. Receive file via multer (memory storage)
//   2. Upload buffer → S3
//   3. Save Chat to MongoDB
//   4. ACK sender over WS
//   5. Deliver to receiver over WS  OR  FCM if offline
//
// Location + Contact come in as WS messages (no file) — see
// handlePrivateLocation / handlePrivateContact at the bottom of this file.

const { PutObjectCommand } = require("@aws-sdk/client-s3");
const s3Client   = require("../../config/s3");
const { userSockets } = require("../socketState");
const Chat       = require("../../models/Chat");
const Token      = require("../../models/FcmToken");
const admin      = require("../../services/firebaseService");
const PendingDelivery = require("../../models/PendingDelivery");
const multer     = require("multer");
const { v4: uuidv4 } = require("uuid");
const CodeConnected = require("../../models/CodeConnected");

// ── Multer: memory storage (same approach as your voice handler) ─────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 50 * 1024 * 1024 }, // 50 MB cap
});

// ── S3 bucket (same bucket your voice handler uses) ──────────────────────────
const BUCKET = process.env.AWS_BUCKET_NAME;

// ── Upload a buffer to S3, return { fileUrl, fileKey } ──────────────────────
async function uploadFileToS3(buffer, mimeType, fileKey) {
  console.log("📥 uploadFileToS3 called");
  console.log("📦 Buffer size (bytes):", buffer.length);
  console.log("🗂️ fileKey:", fileKey);
  console.log("🪣 Bucket:", BUCKET);

  await s3Client.send(
    new PutObjectCommand({
      Bucket:      BUCKET,
      Key:         fileKey,
      Body:        buffer,
      ContentType: mimeType,
    })
  );

  const fileUrl = `https://${BUCKET}.s3.ap-south-1.amazonaws.com/${fileKey}`;
  console.log("✅ Uploaded to S3. URL:", fileUrl);
  return { fileUrl, fileKey };
}

// ── Shared: deliver to receiver or queue FCM ─────────────────────────────────
async function deliverOrFcm({ chat, wsPayload, senderSocket, pushBody }) {
  const receiverSocket = userSockets.get(chat.receiver);

  if (receiverSocket?.readyState === 1) {
    // Online — deliver over WS
    receiverSocket.send(JSON.stringify(wsPayload));

    chat.status      = "delivered";
    chat.deliveredAt = Date.now();
    await chat.save();

    if (senderSocket?.readyState === 1) {
      senderSocket.send(JSON.stringify({
        type:      "delivered_ack",
        messageId: chat._id,
        sender:    chat.sender,
        receiver:  chat.receiver,
        timestamp: chat.deliveredAt,
      }));
    } else {
      // Sender went offline between send and ack — queue it
      await PendingDelivery.create({
        sender:    chat.sender,
        receiver:  chat.receiver,
        messageId: chat._id,
        timestamp: chat.deliveredAt,
      });
    }
  } 
  // else {
  //   // Offline — FCM
  //   console.log("📴 Receiver offline → using FCM");
  //   const tokenDoc = await Token.findOne({ userId: chat.receiver, isActive: true });
  //   if (tokenDoc?.token) {
  //     try {
  //       await admin.messaging().send({
  //         token: tokenDoc.token,
  //         // notification: { title: `New message from ${chat.senderName}`, body: pushBody },
  //         data: {
  //           type:        "chat_message_reply",
  //           sender:      chat.sender,
  //           receiver:    chat.receiver,
  //           messageType: chat.messageType,
  //           messageId:   String(chat._id),
  //         },
  //         android: { priority: "high" },
  //       });
  //       console.log("✅ FCM sent");
  //     } catch (err) {
  //       console.error(`❌ FCM Error for ${chat.receiver}:`, err.message);
  //     }
  //   }
  // }

  const tokenDoc = await Token.findOne({ userId: chat.receiver, isActive: true });
  const codeConnected = await CodeConnected.findOne({code:chat.receiver})

    if (tokenDoc?.token && codeConnected.notify) {
      try {
        await admin.messaging().send({
          token: tokenDoc.token,
          // notification: { title: `New message from ${chat.senderName}`, body: pushBody },
          data: {
            type:        "chat_message_reply",
            sender:      chat.sender,
            receiver:    chat.receiver,
            senderName: chat.senderName,
            messageType: chat.messageType,
            messageId:   String(chat._id),
          },
          android: { priority: "high" },
        });
        console.log("✅ FCM sent");
      } catch (err) {
        console.error(`❌ FCM Error for ${chat.receiver}:`, err.message);
      }
    }
}

// ════════════════════════════════════════════════════════════════════════════
//  HTTP handler — POST /api/chat/send-attachment
//  Fields (multipart/form-data):
//    file         — binary (required for image/video/document/audio)
//    sender       — userId
//    senderName
//    receiver     — userId
//    receiverName
//    tempId       — client UUID for optimistic UI
//    messageType  — "image" | "video" | "document" | "audio"
//    caption      — optional text shown below the file
// ════════════════════════════════════════════════════════════════════════════
const uploadMiddleware = upload.single("file");

async function handleAttachmentUpload(req, res) {
  uploadMiddleware(req, res, async (err) => {
    if (err) {
      console.error("❌ Multer error:", err.message);
      return res.status(400).json({ success: false, message: err.message });
    }

    try {
      const {
        sender,
        senderName,
        receiver,
        receiverName,
        tempId,
        messageType = "document",
        caption     = "",
        duration    = 0,
      } = req.body;

      console.log("tempId------",tempId)

      if (!sender || !receiver) {
        return res.status(400).json({ success: false, message: "sender and receiver are required" });
      }
      if (!req.file) {
        return res.status(400).json({ success: false, message: "No file uploaded" });
      }

      console.log(`\n📎 handleAttachmentUpload — ${messageType}`);
      console.log(`➡️ Sender: ${sender} | Receiver: ${receiver}`);
      console.log(`📄 File: ${req.file.originalname} (${req.file.size} bytes)`);

      // ── Build S3 key — same naming convention as voice ───────────────────
      const ext     = req.file.originalname.split(".").pop() || "bin";
      const fileKey = `${messageType}/${Date.now()}_${sender}_${receiver}.${ext}`;

      // ── Upload to S3 ────────────────────────────────────────────────────
      const { fileUrl } = await uploadFileToS3(
        req.file.buffer,
        req.file.mimetype,
        fileKey
      );

      // ── Save to MongoDB ─────────────────────────────────────────────────
      const chat = new Chat({
        sender,
        receiver,
        senderName,
        receiverName,
        message:      caption || req.file.originalname,
        timestamp:    Date.now(),
        status:       "sent",
        messageType,
        fileUrl,
        fileKey,
        fileName:     req.file.originalname,
        fileSize:     req.file.size,
        fileMimeType: req.file.mimetype,
        duration:     Number(duration),
      });
      await chat.save();
      console.log("💾 Chat saved. ID:", chat._id);

      // ── WS payload (same shape as private_voice response) ───────────────
      const wsPayload = {
        type:         "private_attachment",
        id:           chat._id,
        sender,
        receiver,
        senderName,
        receiverName,
        message:      chat.message,
        timestamp:    chat.timestamp,
        messageType,
        fileUrl,
        fileKey,
        fileName:     req.file.originalname,
        fileSize:     req.file.size,
        fileMimeType: req.file.mimetype,
        duration:     Number(duration),
      };

      // ── ACK sender (update_private_messageid — same as voice) ────────────
      const senderSocket = userSockets.get(sender);
      if (senderSocket?.readyState === 1) {
        senderSocket.send(JSON.stringify({
          type:      "update_private_messageid",
          tempId,
          messageId: chat._id,
          timestamp: chat.timestamp,
          status:    "sent",
        }));
        console.log("✅ Sent ACK to sender");
      }

      // ── Deliver or FCM ───────────────────────────────────────────────────
      await deliverOrFcm({
        chat,
        wsPayload,
        senderSocket,
        pushBody: pushBodyForType(messageType, req.file.originalname),
      });

      return res.status(201).json({
        success:   true,
        messageId: chat._id,
        timestamp: chat.timestamp,
        fileUrl,
        fileKey,
        fileName:     req.file.originalname,
        fileSize:     req.file.size,
        fileMimeType: req.file.mimetype,
      });
    } catch (e) {
      console.error("❌ handleAttachmentUpload error:", e);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  });
}

// ════════════════════════════════════════════════════════════════════════════
//  WS handler — type: "private_location"
//  Payload: { sender, senderName, receiver, receiverName,
//             latitude, longitude, address, tempId }
// ════════════════════════════════════════════════════════════════════════════
async function handlePrivateLocation(ws, parsed) {
  const {
    sender, senderName,
    receiver, receiverName,
    latitude, longitude, address = "",
    tempId,
  } = parsed;

  console.log(`\n📍 handlePrivateLocation`);
  console.log(`➡️ Sender: ${sender} | Receiver: ${receiver}`);

  const chat = new Chat({
    sender, receiver, senderName, receiverName,
    message:     `📍 Location${address ? `: ${address}` : ""}`,
    timestamp:   Date.now(),
    status:      "sent",
    messageType: "location",
    latitude,
    longitude,
    address,
  });
  await chat.save();
  console.log("💾 Location chat saved. ID:", chat._id);

  const senderSocket = userSockets.get(sender);
  if (senderSocket?.readyState === 1) {
    senderSocket.send(JSON.stringify({
      type:      "update_private_messageid",
      tempId,
      messageId: chat._id,
      timestamp: chat.timestamp,
      status:    "sent",
    }));
  }

  const wsPayload = {
    type: "private_location",
    id:   chat._id,
    sender, receiver, senderName, receiverName,
    message:   chat.message,
    timestamp: chat.timestamp,
    messageType: "location",
    latitude, longitude, address,
  };

  await deliverOrFcm({
    chat,
    wsPayload,
    senderSocket,
    pushBody: `📍 Location${address ? `: ${address}` : ""}`,
  });
}

// ════════════════════════════════════════════════════════════════════════════
//  WS handler — type: "private_contact"
//  Payload: { sender, senderName, receiver, receiverName,
//             contactName, contactPhone, tempId }
// ════════════════════════════════════════════════════════════════════════════
async function handlePrivateContact(ws, parsed) {
  const {
    sender, senderName,
    receiver, receiverName,
    contactName, contactPhone,
    tempId,
  } = parsed;

  console.log(`\n📇 handlePrivateContact`);
  console.log(`➡️ Sender: ${sender} | Receiver: ${receiver}`);

  const chat = new Chat({
    sender, receiver, senderName, receiverName,
    message:      `📇 ${contactName} — ${contactPhone}`,
    timestamp:    Date.now(),
    status:       "sent",
    messageType:  "contact",
    contactName,
    contactPhone,
  });
  await chat.save();
  console.log("💾 Contact chat saved. ID:", chat._id);

  const senderSocket = userSockets.get(sender);
  if (senderSocket?.readyState === 1) {
    senderSocket.send(JSON.stringify({
      type:      "update_private_messageid",
      tempId,
      messageId: chat._id,
      timestamp: chat.timestamp,
      status:    "sent",
    }));
  }

  const wsPayload = {
    type: "private_contact",
    id:   chat._id,
    sender, receiver, senderName, receiverName,
    message:     chat.message,
    timestamp:   chat.timestamp,
    messageType: "contact",
    contactName,
    contactPhone,
  };

  await deliverOrFcm({
    chat,
    wsPayload,
    senderSocket,
    pushBody: `📇 ${contactName}`,
  });
}

async function handleShareMedia(ws, parsed) {
  console.log("\n================ SHARE MEDIA START ================");
  console.log("📥 Incoming Payload:");
  console.log(JSON.stringify(parsed, null, 2));

  const {
    sender,
    senderName,
    receiver,
    receiverName,
    fileUrl,
    messageType = "image",
    message = "",
    tempId,
  } = parsed;

  console.log("Sender:", sender);
  console.log("Sender Name:", senderName);
  console.log("Receiver:", receiver);
  console.log("Receiver Name:", receiverName);
  console.log("Message:", message);
  console.log("Message Type:", messageType);
  console.log("File URL:", fileUrl);
  console.log("Temp ID:", tempId);

  if (!fileUrl) {
    console.log("❌ fileUrl is missing");
    return ws.send(
      JSON.stringify({
        type: "error",
        message: "fileUrl is required",
      })
    );
  }

  console.log("📝 Creating chat document...");

  const chat = new Chat({
    sender,
    receiver,
    senderName,
    receiverName,
    message,
    timestamp: Date.now(),
    status: "sent",
    messageType,
    fileUrl,
  });

  console.log("📄 Chat Object:");
  console.log(chat);

  console.log("💾 Saving chat...");
  await chat.save();

  console.log("✅ Chat saved successfully");
  console.log("Mongo ID:", chat._id);
  console.log("Timestamp:", chat.timestamp);

  const senderSocket = userSockets.get(sender);

  console.log("🔌 Sender Socket Exists:", !!senderSocket);
  console.log(
    "🔌 Sender Socket ReadyState:",
    senderSocket ? senderSocket.readyState : "No Socket"
  );

  if (senderSocket?.readyState === 1) {
    console.log("📤 Sending update_private_messageid to sender");

    const ackPayload = {
      type: "update_private_messageid",
      tempId,
      messageId: chat._id,
      timestamp: chat.timestamp,
      status: "sent",
    };

    console.log("Ack Payload:");
    console.log(JSON.stringify(ackPayload, null, 2));

    senderSocket.send(JSON.stringify(ackPayload));

    console.log("✅ Ack sent");
  } else {
    console.log("⚠️ Sender socket not connected");
  }

  const wsPayload = {
    type: "private_attachment",
    id: chat._id,
    sender,
    receiver,
    senderName,
    receiverName,
    message: chat.message,
    timestamp: chat.timestamp,
    messageType,
    fileUrl,
  };

  console.log("📦 WebSocket Payload:");
  console.log(JSON.stringify(wsPayload, null, 2));

  console.log("📨 Calling deliverOrFcm()");

  await deliverOrFcm({
    chat,
    wsPayload,
    senderSocket,
    pushBody: pushBodyForType(messageType),
  });

  console.log("✅ deliverOrFcm completed");

  console.log("=============== SHARE MEDIA END ===============\n");
}

// ── FCM body per attachment type ──────────────────────────────────────────────
function pushBodyForType(messageType, fileName = "") {
  switch (messageType) {
    case "image":    return "📷 Image";
    case "video":    return "🎬 Video";
    case "audio":    return "🎵 Audio";
    case "document": return `📄 ${fileName}`;
    default:         return "📎 Attachment";
  }
}


module.exports = {
  handleAttachmentUpload,
  handlePrivateLocation,
  handlePrivateContact,
  handleShareMedia,
};