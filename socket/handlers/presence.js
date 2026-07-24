const { userSockets, groupOnline } = require("../socketState");
const Chat = require("../../models/Chat");
const Group = require("../../models/Group");
const CodeConnected = require("../../models/CodeConnected");

async function handlePresence(ws, parsed) {
  const { sender: code, isOnline, notify, timestamp } = parsed;
  await CodeConnected.findOneAndUpdate(
    { code },
    { active: isOnline, notify, lastActive: Date.now() },
    { upsert: true }
  );

  const sentPartners = await Chat.distinct("receiver", { sender: code });
  const receivedPartners = await Chat.distinct("sender", { receiver: code });
  const allPartners = [...new Set([...sentPartners, ...receivedPartners])];

  const thisSocket = userSockets.get(code);

  for (const partner of allPartners) {
    const partnerSocket = userSockets.get(partner);
    if (partnerSocket?.readyState === 1) {
      // Tell partner that `code` is online
      partnerSocket.send(JSON.stringify({
        type: "presence", sender: code, receiver: partner,
        isOnline, timestamp,
      }));

      // Tell `code` that partner is online
      if (thisSocket?.readyState === 1) {
        thisSocket.send(JSON.stringify({
          type: "presence", sender: partner, receiver: code,
          isOnline: true, timestamp: Date.now(),
        }));
      }
    }
  }
}

async function handleGroupPresence(ws, parsed) {
  const { groupId, sender, isOnline } = parsed;

  if (!groupOnline.has(groupId)) groupOnline.set(groupId, new Set());
  const onlineSet = groupOnline.get(groupId);

  isOnline ? onlineSet.add(sender) : onlineSet.delete(sender);
  groupOnline.set(groupId, onlineSet);

  const totalOnline = onlineSet.size;
  const group = await Group.findOne({ groupId });
  if (!group) return;

  const payload = JSON.stringify({
    type: "group_online_count",
    groupId, count: totalOnline, timestamp: Date.now(),
  });

  for (const member of group.members) {
    if (member === sender) continue;
    userSockets.get(member)?.readyState === 1 && userSockets.get(member).send(payload);
  }

  userSockets.get(sender)?.readyState === 1 && userSockets.get(sender).send(payload);
}

module.exports = { handlePresence, handleGroupPresence };