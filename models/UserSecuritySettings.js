const mongoose = require("mongoose");

const DeviceSchema = new mongoose.Schema({
  deviceId: { type: String, required: true },
  deviceName: { type: String, required: true },
  location: { type: String},
  verifiedAt: { type: Date, default: Date.now }
});

const UserSecuritySettingsSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },

  // Two-Step Verification
  twoStepEnabled: { type: Boolean, default: false },
  pendingTwoStepChange: {
    newValue: Boolean,
    otp: Number,
    requestedAt: Date
  },

pendingLastDeviceRemoval: {
  otp: Number,
  deviceId: String,
  requestedAt: Date,
  expiresAt: Date
},

  loginAlert: { type: Boolean, default: false },

  // pendingotp
  

  // Last verified device
  lastVerifiedDevice: {
    deviceId: { type: String },
    deviceName: { type: String },
    location: { type: String},
    verifiedAt: { type: Date }
  },

  // List of verified devices
  verifiedDevices: [DeviceSchema]

}, { timestamps: true });

module.exports = mongoose.model(
  "UserSecuritySettings",
  UserSecuritySettingsSchema
);
