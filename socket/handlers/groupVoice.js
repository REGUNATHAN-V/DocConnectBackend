const { userSockets } = require("../socketState");
const Group = require("../../models/Group");
const GroupChat = require("../../models/GroupChat");
const Token = require("../../models/FcmToken");
const admin = require("../../services/firebaseService");
const { uploadVoiceToS3 } = require("../../middlleware/liveAudioUpload");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const s3Client = require("../../config/s3");
const User = require("../../models/User");

async function handleGroupVoice(ws, parsed) {
  const { tempId, groupId, sender, senderName, audioUrl: rawAudio, duration } = parsed;

  const group = await Group.findOne({ groupId });
  if (!group) return console.error(`❌ Group not found: ${groupId}`);

  let members = group.members;
  if (members.length === 1 && members[0].includes(",")) {
    members = members[0].split(",").map((m) => m.trim());
  }

  const s3Data = await uploadVoiceToS3(rawAudio, sender, groupId);

  const url = `https://${process.env.AWS_BUCKET_NAME}.s3.ap-south-1.amazonaws.com/${s3Data.fileKey}`;


  const groupMsg = new GroupChat({
    groupId, sender, senderName,
    audioId: s3Data.fileKey,
    audioUrl: url, duration,
    timestamp: Date.now(), deliveredTo: [],
    status: "sent", messageType: "voice",
  });
  await groupMsg.save();

  // ACK sender
  const senderSocket = userSockets.get(sender);
  if (senderSocket?.readyState === 1) {
    senderSocket.send(JSON.stringify({
      type: "update_group_messageid",
      tempId, messageId: groupMsg._id,
      groupId, timestamp: groupMsg.timestamp, status: "sent",
    }));
  }

  let deliveredCount = 0;

  for (const member of members) {
    if (member === sender) continue;

    const memberSocket = userSockets.get(member);
    const deliveredName = await User.findOne({userId : member });


    if (memberSocket?.readyState === 1) {
      // const url = await getSignedUrl(
      //   s3Client,
      //   new GetObjectCommand({ Bucket: process.env.AWS_BUCKET_NAME, Key: s3Data.fileKey }),
      //   { expiresIn: 60 }
      // );

      memberSocket.send(JSON.stringify({
        type: "group_voice",
        groupId, id: groupMsg._id, groupName: group.name,
        sender, senderName, audioUrl: url, audioId: s3Data.fileKey,
        duration, timestamp: groupMsg.timestamp,
      }));

      deliveredCount++;
      groupMsg.deliveredTo.push({ user: member, timestamp: Date.now() });

      if (senderSocket?.readyState === 1) {
        senderSocket.send(JSON.stringify({
          type: "group_delivered_ack",
          groupId, deliveredTo: member,
          deliveredName: deliveredName.name,
          messageIds: [groupMsg._id], timestamp: Date.now(),
        }));
      }
    } else {
      const tokenDoc = await Token.findOne({ userId: member });
      if (tokenDoc?.token) {
        try {
          await admin.messaging().send({
            token: tokenDoc.token,
            notification: {
              title: `${senderName} sent a voice message`,
              body: `Voice Message (${duration}s) in group: ${group.name}`,
            },
            data: { senderName, timestamp: String(groupMsg.timestamp) },
          });
        } catch (err) {
          console.error(`❌ FCM Error for ${member}: ${err.message}`);
        }
      }
    }
  }

  groupMsg.status = deliveredCount === members.length - 1 ? "delivered" : "pending";
  await groupMsg.save();
}

module.exports = { handleGroupVoice };