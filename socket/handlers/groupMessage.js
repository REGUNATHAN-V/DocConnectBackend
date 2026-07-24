const { userSockets } = require("../socketState");
const Group = require("../../models/Group");
const GroupChat = require("../../models/GroupChat");
const Token = require("../../models/FcmToken");
const admin = require("../../services/firebaseService");
const User = require("../../models/User");
const CodeConnected = require("../../models/CodeConnected");

async function handleGroupMessage(ws, parsed) {
  const { groupId, sender, message, senderName, tempId } = parsed;

  const group = await Group.findOne({ groupId });
  if (!group) return console.error(`❌ Group not found: ${groupId}`);

  let members = group.members;
  if (members.length === 1 && members[0].includes(",")) {
    members = members[0].split(",").map((m) => m.trim());
  }

  const chat = new GroupChat({
    groupId, sender, senderName, message,
    timestamp: Date.now(), status: "sent",
    deliveredTo: [], seenBy: [], messageType: "chat",
  });
  await chat.save();

  // ACK sender
  const senderSocket = userSockets.get(sender);
  if (senderSocket?.readyState === 1) {
    senderSocket.send(JSON.stringify({
      type: "update_group_messageid",
      tempId, messageId: chat._id,
      groupId, timestamp: chat.timestamp, status: "sent",
    }));
  }

  let deliveredCount = 0;

  for (const member of members) {
    if (member === sender) continue;

    const memberSocket = userSockets.get(member);
    const deliveredName = await User.findOne({userId : member });

    if (memberSocket?.readyState === 1) {
      memberSocket.send(JSON.stringify({
        type: "group_message",
        id: chat._id, groupId, groupName: group.name,
        sender, message, senderName, timestamp: chat.timestamp,
      }));

      deliveredCount++;
      chat.deliveredTo.push({ user: member, timestamp: Date.now() });

      


      // Delivered ACK back to sender
      if (senderSocket?.readyState === 1) {
        senderSocket.send(JSON.stringify({
          type: "group_delivered_ack",
          groupId, deliveredTo: member,
          deliveredName: deliveredName.name,
          messageIds: [chat._id], timestamp: Date.now(),
        }));
      }
    }
    //  else {
      // Push for offline member
      const tokenDoc = await Token.findOne({ userId: member });
      console.log("member-->",member)
  const codeConnected = await CodeConnected.findOne({code:member})
  console.log(codeConnected)

      if (tokenDoc?.token && codeConnected.notify) {
        try {
          await admin.messaging().send({
            token: tokenDoc.token,
            notification: { title: `${senderName} (Group: ${group.name})`, body: message },
            data: {
              type: "group_message", groupId, sender, senderName,
              message, timestamp: String(chat.timestamp), messageId: String(chat._id),
            },
            android: { priority: "high" },
          });
        } catch (err) {
          console.error(`❌ FCM Error for ${member}: ${err.message}`);
        }
      }
    // }
  }

  chat.status = deliveredCount === members.length - 1 ? "delivered" : "pending";
  await chat.save();
}

module.exports = { handleGroupMessage };