const { userSockets } = require("../socketState");
const Chat = require("../../models/Chat");
const Token = require("../../models/FcmToken");
const admin = require("../../services/firebaseService");
const { uploadVoiceToS3 } = require("../../middlleware/liveAudioUpload");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const s3Client = require("../../config/s3");
const CodeConnected = require("../../models/CodeConnected");

// async function handlePrivateVoice(ws, parsed) {
//   const { sender, senderName, receiver, receiverName, audioUrl: rawAudio, duration, tempId } = parsed;

//   try {
//     const s3Data = await uploadVoiceToS3(rawAudio, sender, receiver);

//     const chat = new Chat({
//       sender, receiver, senderName, receiverName,
//       audioId: s3Data.fileKey, duration,
//       timestamp: Date.now(), status: "sent", messageType: "voice",
//     });
//     await chat.save();

//     // ACK sender
//     const senderSocket = userSockets.get(sender);
//     if (senderSocket?.readyState === 1) {
//       senderSocket.send(JSON.stringify({
//         type: "update_private_messageid",
//         tempId, messageId: chat._id,
//         timestamp: chat.timestamp, status: "sent",
//       }));
//     }

//     // // Generate signed URL

//     // BY me
    
//     // const url = await getSignedUrl(
//     //   s3Client,
//     //   new GetObjectCommand({ Bucket: process.env.AWS_BUCKET_NAME, Key: s3Data.fileKey }),
//     //   { expiresIn: 60 }
//     // );

//     const url = `https://${process.env.AWS_BUCKET_NAME}.s3.ap-south-1.amazonaws.com/${s3Data.fileKey}`;

//     console.log("📥 Voice URL:", url);

//     // Deliver to receiver
//     const receiverSocket = userSockets.get(receiver);
//     if (receiverSocket?.readyState === 1) {
//       receiverSocket.send(JSON.stringify({
//         type: "private_voice",
//         id: chat._id, sender, senderName, receiver, receiverName,
//         audioUrl: url, audioId: s3Data.fileKey,
//         duration, messageType: chat.messageType, timestamp: chat.timestamp,
//       }));

//       chat.status = "delivered";
//       chat.deliveredAt = Date.now();
//       await chat.save();

//       if (senderSocket?.readyState === 1) {
//         senderSocket.send(JSON.stringify({
//           type: "delivered_ack",
//           sender: chat.sender, receiver: chat.receiver,
//           messageId: chat._id, timestamp: chat.deliveredAt,
//         }));
//       }
//     } else {
//       const tokenDoc = await Token.findOne({ userId: receiver,isActive:true });
//       if (tokenDoc?.token) {
//         try {
//           await admin.messaging().send({
//             token: tokenDoc.token,
//             notification: { title: `${sender} sent a voice message`, body: `Voice Message (${duration}s)` },
//           });
//         } catch (err) {
//           console.error(`❌ FCM Error for ${receiver}: ${err.message}`);
//         }
//       }
//     }
//   } catch (err) {
//     console.error("Failed to upload voice:", err);
//   }
// }

async function handlePrivateVoice(ws, parsed) {
  const { sender, senderName, receiver, receiverName, audioUrl: rawAudio, duration, tempId } = parsed;

  console.log("🎤 handlePrivateVoice called");
  console.log("➡️ Sender:", sender, "| Receiver:", receiver);
  console.log("⏱️ Duration:", duration, "| TempId:", tempId);

  try {
    // 🔹 Upload to S3
    console.log("☁️ Uploading audio to S3...");
    const s3Data = await uploadVoiceToS3(rawAudio, sender, receiver);
    console.log("✅ Uploaded to S3. FileKey:", s3Data.fileKey);

        // 🔹 Public URL (correct)
        const url = `https://${process.env.AWS_BUCKET_NAME}.s3.ap-south-1.amazonaws.com/${s3Data.fileKey}`;
        console.log("🔗 Voice URL:", url);

    // 🔹 Save chat
    const chat = new Chat({
      sender, receiver, senderName, receiverName,
      audioId: s3Data.fileKey,
      audioUrl: url,
      duration,
      timestamp: Date.now(),
      status: "sent",
      messageType: "voice",
    });

    await chat.save();
    console.log("💾 Chat saved. ID:", chat._id);

    // 🔹 ACK sender
    const senderSocket = userSockets.get(sender);
    console.log("📡 Sender socket:", senderSocket ? "Connected" : "Not connected");

    if (senderSocket?.readyState === 1) {
      senderSocket.send(JSON.stringify({
        type: "update_private_messageid",
        tempId,
        messageId: chat._id,
        timestamp: chat.timestamp,
        status: "sent",
      }));
      console.log("✅ Sent ACK to sender");
    }



    // 🔹 Deliver to receiver
    const receiverSocket = userSockets.get(receiver);
    console.log("📡 Receiver socket:", receiverSocket ? "Connected" : "Offline");

    if (receiverSocket?.readyState === 1) {
      receiverSocket.send(JSON.stringify({
        type: "private_voice",
        id: chat._id,
        sender,
        senderName,
        receiver,
        receiverName,
        audioUrl: url,
        audioId: s3Data.fileKey,
        duration,
        messageType: chat.messageType,
        timestamp: chat.timestamp,
      }));

      console.log("📤 Voice message delivered via WebSocket");

      chat.status = "delivered";
      chat.deliveredAt = Date.now();
      await chat.save();
      console.log("📦 Chat marked as delivered");

      if (senderSocket?.readyState === 1) {
        senderSocket.send(JSON.stringify({
          type: "delivered_ack",
          sender: chat.sender,
          receiver: chat.receiver,
          messageId: chat._id,
          timestamp: chat.deliveredAt,
        }));
        console.log("📬 Delivered ACK sent to sender");
      }

    } 
    
    // else {
    //   // 🔹 FCM fallback
    //   console.log("📴 Receiver offline → using FCM");


    //   const tokenDoc = await Token.findOne({ userId: receiver, isActive: true });
    //   console.log("🔍 TokenDoc:", tokenDoc);

    //   if (tokenDoc?.token) {
    //     try {
    //       console.log("📲 Sending FCM to:", tokenDoc.token);

    //       const response = await admin.messaging().send({
    //         token: tokenDoc.token,
    //         notification: {
    //           title: `${sender} sent a voice message`,
    //           body: `Voice Message (${duration}s)`
    //         },
    //       });

    //       console.log("✅ FCM sent successfully:", response);

    //     } catch (err) {
    //       console.error(`❌ FCM Error for ${receiver}:`, err.message);
    //     }
    //   } else {
    //     console.warn("⚠️ No active FCM token for user:", receiver);
    //   }
    // }

    const codeConnected = await CodeConnected.findOne({code:receiver})
    const tokenDoc = await Token.findOne({ userId: receiver, isActive: true });


    if (tokenDoc?.token && codeConnected.notify) {
      try {
        console.log("📲 Sending FCM to:", tokenDoc.token);

        const response = await admin.messaging().send({
          token: tokenDoc.token,
          notification: {
            title: `${sender} sent a voice message`,
            body: `Voice Message (${duration}s)`
          },
        });

        console.log("✅ FCM sent successfully:", response);

      } catch (err) {
        console.error(`❌ FCM Error for ${receiver}:`, err.message);
      }
    }

  } catch (err) {
    console.error("❌ Failed in handlePrivateVoice:", err.message);
    console.error("🧨 Full Error:", err);
  }
}

module.exports = { handlePrivateVoice };