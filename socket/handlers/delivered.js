const { userSockets } = require("../socketState");
const Chat = require("../../models/Chat");
const GroupChat = require("../../models/GroupChat");
const Group = require("../../models/Group");

async function handleDelivered(ws, parsed) {
  const { messageId, sender: originalSender, receiver: ackBy } = parsed;

  if (messageId) {
    const m = await Chat.findById(messageId);
    if (m && m.status === "sent") {
      m.status = "delivered";
      m.deliveredAt = Date.now();
      await m.save();
    }

    const sSocket = userSockets.get(m?.sender || originalSender);
    if (sSocket?.readyState === 1) {
      sSocket.send(JSON.stringify({
        type: "delivered_ack",
        messageId,
        sender: m ? m.sender : originalSender,
        receiver: ackBy || m?.receiver,
        timestamp: Date.now(),
      }));
    }
  } else if (originalSender && ackBy) {
    const res = await Chat.updateMany(
      { sender: originalSender, receiver: ackBy, status: "sent" },
      { $set: { status: "delivered", deliveredAt: Date.now() } }
    );

    const sSocket = userSockets.get(originalSender);
    if (sSocket?.readyState === 1) {
      sSocket.send(JSON.stringify({
        type: "delivered_bulk_ack",
        sender: originalSender, receiver: ackBy,
        timestamp: Date.now(), count: res.modifiedCount,
      }));
    }
  }
}

async function handleGroupDelivered(ws, parsed) {
  const { groupId, sender, messageIds } = parsed;

  const group = await Group.findOne({ groupId });
  if (!group) return;

  await GroupChat.updateMany(
    { _id: { $in: messageIds } },
    {
      $addToSet: { deliveredTo: { user: sender, timestamp: Date.now() } },
      $set: { deliveredAt: Date.now() },
    }
  );

  for (const member of group.members) {
    if (member === sender) continue;
    const memberSocket = userSockets.get(member);
    if (memberSocket?.readyState === 1) {
      memberSocket.send(JSON.stringify({
        type: "group_delivered_ack",
        groupId, deliveredBy: sender, messageIds, timestamp: Date.now(),
      }));
    }
  }
}

module.exports = { handleDelivered, handleGroupDelivered };