const mongoose = require("mongoose");

const HybridLoginRequestSchema = new mongoose.Schema({
  userId: { type: String, required: true },           // User logging in
  currentLoginRequestId: { type: String},
  newDeviceId: { type: String, required: true },      // Device trying to login
  newDeviceName: { type: String },                    // Device name
  newDeviceLocation: { type: String },                // Device location
  newDeviceToken: { type: String },                // Device location
  status: { 
    type: String, 
    enum: ["pending", "approved", "denied"], 
    default: "pending" 
  },
  requestedAt: { type: Date, default: Date.now },
  approvedByDeviceId: { type: String },               // Older device approving
  approvedAt: { type: Date }                          // Timestamp of approval/denial
}, { timestamps: true });

module.exports = mongoose.model("HybridLoginRequest", HybridLoginRequestSchema);
