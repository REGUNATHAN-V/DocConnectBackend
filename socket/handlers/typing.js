const { userSockets } = require("../socketState");
const Group = require("../../models/Group");

function handleTyping(ws, parsed) {
  const { sender, receiver, isTyping } = parsed;
  const receiverSocket = userSockets.get(receiver);
  if (receiverSocket?.readyState === 1) {
    receiverSocket.send(JSON.stringify({
      type: "typing", sender, receiver, isTyping: !!isTyping,
    }));
  }
}

async function handleGroupTyping(ws, parsed) {
  const { groupId, sender, isTyping } = parsed;
  const group = await Group.findOne({ groupId });
  if (!group) return console.log(`❌ Group ${groupId} not found`);

  for (const member of group.members) {
    if (member === sender) continue;
    const memberSocket = userSockets.get(member);
    if (memberSocket?.readyState === 1) {
      memberSocket.send(JSON.stringify({ type: "group_typing", groupId, sender, isTyping }));
    }
  }
}

module.exports = { handleTyping, handleGroupTyping };