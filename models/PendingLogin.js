const mongoose = require("mongoose");

const PendingDeviceLoginSchema = new mongoose.Schema({
  userId: { type: String, required: true },        // User who is logging in
  newDeviceId: { type: String, required: true },   // Device trying to login
  newDeviceName: { type: String },                 // Device name
  newDeviceLocation: { type: String },             // Location of new device
  status: { 
    type: String, 
    enum: ["pending", "approved", "denied"], 
    default: "pending" 
  },                                               // Pending / Approved / Denied
  requestedAt: { type: Date, default: Date.now }, // When request was made
  approvedByDeviceId: { type: String },           // DeviceId of older device approving
  approvedAt: { type: Date }                       // When request was approved/denied
}, { timestamps: true });

module.exports = mongoose.model("PendingDeviceLogin", PendingDeviceLoginSchema);
