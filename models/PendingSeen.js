const mongoose = require("mongoose");

const PendingSeenSchema = new mongoose.Schema({
  sender: String,
  receiver: String,
  messageIds: [mongoose.Schema.Types.ObjectId],
  timestamp: Number,
  count: String
});

module.exports = mongoose.model("PendingSeen", PendingSeenSchema);
