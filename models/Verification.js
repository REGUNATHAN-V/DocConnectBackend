const mongoose = require("mongoose");

const verificationSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true }, 
  m_key: { type: String, default: "" },
  fcmtoken:{type: String, required: true},
  otp: { type: String },
  otpExpires: { type: Date },
  connected: { type: Boolean, default: false },
  lastActive: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Verification", verificationSchema);

