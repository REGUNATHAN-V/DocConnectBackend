const mongoose = require("mongoose");

const loginHistorySchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  }, 
  action: {
    type: String,
    enum: ["login", "logout","register"],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  ipAddress: String, // optional: store IP address if needed
  userAgent: String  // optional: store browser/device info
});

module.exports = mongoose.model("LoginHistory", loginHistorySchema);
