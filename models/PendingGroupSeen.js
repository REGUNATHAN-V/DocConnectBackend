const mongoose = require("mongoose");

const PendingGroupSeenSchema = new mongoose.Schema({
  sender: String,
  groupId: String,
  seenBy: String,
  seenName: String,
  messageIds: [mongoose.Schema.Types.ObjectId],
  timestamp: Number,
});

module.exports = mongoose.model("PendingGroupSeen", PendingGroupSeenSchema);
