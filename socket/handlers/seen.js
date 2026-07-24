const { userSockets } = require("../socketState");
const Chat = require("../../models/Chat");
const GroupChat = require("../../models/GroupChat");
const Group = require("../../models/Group");
const PendingSeen = require("../../models/PendingSeen");
const PendingGroupSeen = require("../../models/PendingGroupSeen");
const User = require("../../models/User");

async function handleSeen(ws, parsed) {
  const { messageIds, sender: originalSender } = parsed;

  for (const messageId of messageIds) {
    const m = await Chat.findById(messageId);
    if (!m) continue;

    if (m.status !== "seen") {
      m.status = "seen";
      m.seenAt = Date.now();
      await m.save();
    }

    const sSocket = userSockets.get(m.sender || originalSender);
    if (sSocket?.readyState === 1) {
      sSocket.send(JSON.stringify({
        type: "seen_ack",
        messageId: [messageId], sender: m.sender,
        receiver: m.receiver, timestamp: Date.now(),
      }));
    } else {
      await PendingSeen.create({
        sender: m.sender, receiver: m.receiver,
        messageIds: messageId, timestamp: Date.now(),
      });
    }
  }
}

async function handleGroupSeen(ws, parsed) {
  const { groupId, sender, messageIds } = parsed;

  const group = await Group.findOne({ groupId });

  const senderName = await User.findOne({userId : sender });
  console.log("senderName-----",senderName);
  if (!group || !senderName || !messageIds ) return console.log(`Group not found`);

  // Update seenBy for all messages
  await GroupChat.updateMany(
    { _id: { $in: messageIds } },
    { $addToSet: { seenBy: { user: sender, timestamp: Date.now() } } }
  );



  // Check if fully seen
  let members = group.members;
  if (members.length === 1 && members[0].includes(",")) {
    members = members[0].split(",").map((m) => m.trim());
  }

  for (const messageId of messageIds) {
    const msg = await GroupChat.findById(messageId);
    if (!msg) continue;

    const otherMembers = members.filter((m) => m !== msg.sender);
    const seenUsers = msg.seenBy.map((s) => s.user);
    if (otherMembers.every((m) => seenUsers.includes(m))) {
      msg.status = "seen";
      msg.seenAt = Date.now();
      await msg.save();
    }
  }

  // Find original sender for pending queue
  const findSender = await GroupChat.findOne({ _id: messageIds[0] });

  let offline = false;
  for (const member of group.members) {
    if (member === sender) continue;
    const memberSocket = userSockets.get(member);
    if (memberSocket?.readyState === 1) {
      memberSocket.send(JSON.stringify({
        type: "group_seen_ack",
        groupId, seenBy: sender, seenName: senderName.name, messageIds, timestamp: Date.now(),
      }));
    } else {
      offline = true;
    }
  }

  if (offline && findSender) {
    await PendingGroupSeen.create({
      sender: findSender.sender, seenName: findSender.senderName, groupId,
      seenBy: sender, messageIds, timestamp: Date.now(),
    });
  }
}

module.exports = { handleSeen, handleGroupSeen };