const { userSockets } = require("../socketState");
const Group = require("../../models/Group");

async function handleCreateGroup(ws, parsed) {
  const { groupName, adminName, members, admin, profilePic} = parsed;

  if (!groupName || !members || !admin || !adminName) {
    return ws.send(JSON.stringify({
      type: "error",
      message: "Missing required fields (groupName, members, admin, adminName)",
    }));
  }

  if (!Array.isArray(members) || members.length < 2) {
    return ws.send(JSON.stringify({
      type: "error",
      message: "Group must have at least 2 members",
    }));
  }

  const uniqueMembers = [...new Set([...members, admin])];
  const groupId = "GRP" + Date.now();

  const newGroup = new Group({ groupId, name: groupName, adminName, members: uniqueMembers, admin, profilePic});
  const savedGroup = await newGroup.save();

  // Notify all non-admin members
  uniqueMembers.forEach((memberCode) => {
    if (memberCode === admin) return;
    const memberSocket = userSockets.get(memberCode);
    if (memberSocket?.readyState === 1) {
      memberSocket.send(JSON.stringify({
        type: "group_create_ack",
        message: `You have been added by ${adminName}`,
        groupId, groupName, senderName: adminName,
        addedBy: admin, createdDate: savedGroup.createdAt,
        totalMembers: uniqueMembers.length, members: uniqueMembers,
        profilePic,
      }));
    }
  });

  // Respond to creator
  ws.send(JSON.stringify({
    type: "group_created_success",
    message: "Group had been created by You",
    groupId, groupName, admin, adminName,
    createdDate: savedGroup.createdAt,
    totalMembers: uniqueMembers.length, members: uniqueMembers,
    profilePic,
  }));
}

module.exports = { handleCreateGroup };
