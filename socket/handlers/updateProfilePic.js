const { userSockets } = require("../socketState");
const PendingProfileUpdate = require("../../models/PendingProfileUpdate");
const Chat = require("../../models/Chat");


async function handleUpdateProfilePic(ws, parsed) {
  const { sender, profilePic } = parsed;
  if (!sender || !profilePic) return;


  const sentTo       = await Chat.find({ sender }).distinct("receiver");
  const receivedFrom = await Chat.find({ receiver: sender }).distinct("sender");

  const contactSet = new Set([...sentTo, ...receivedFrom]);
  contactSet.delete(sender);

  for (const contactCode of contactSet) {
    const contactSocket = userSockets.get(contactCode);
    if (contactSocket?.readyState === 1) {
      contactSocket.send(JSON.stringify({
        type: "profile_pic_updated",
        userCode: sender,
        profilePic,           
        timestamp: Date.now(),
      }));
    } else {
      await PendingProfileUpdate.findOneAndUpdate(
        { to: contactCode, userCode: sender },
        { profilePic, timestamp: Date.now() },
        { upsert: true }
      );
    }
  }

//   if (ws?.readyState === 1) {
//     ws.send(JSON.stringify({
//       type: "profile_pic_update_ack",
//       success: true,
//       profilePic,
//       timestamp: Date.now(),
//     }));
//   }
}

module.exports = { handleUpdateProfilePic };