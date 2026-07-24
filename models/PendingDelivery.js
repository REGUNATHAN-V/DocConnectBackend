const mongoose = require("mongoose");

const PendingDeliverySchema = new mongoose.Schema({
  sender: String,
  groupId: String,
  deliveredBy: String,
  messageId: String,
  timestamp: Number,
  receiver: String,
});

module.exports = mongoose.model("PendingDelivery", PendingDeliverySchema);
