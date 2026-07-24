const mongoose = require("mongoose");

// const FcmTokenSchema = new mongoose.Schema({
//   userId: { type: String, default: null },  // Attach after login
//   deviceId: { type: String, required: true, unique: true }, // unique per device
//   token: { type: String, required: true },
//   deviceName: { type: String },
//   location: { type: String ,default: null },
//   updatedAt: { type: Date, default: Date.now },
// }, { timestamps: true });

// // Ensure deviceId is unique
// FcmTokenSchema.index({ deviceId: 1 }, { unique: true });

// module.exports = mongoose.model("FcmToken", FcmTokenSchema);


const FcmTokenSchema = new mongoose.Schema({
  userId:     { type: String },
  deviceId:   { type: String, required: true },
  token:      { type: String, required: true },
  deviceName: { type: String },
  location:   { type: String, default: null },
  isActive:   { type: Boolean, default: true }, 
}, { timestamps: true });

// Unique per user + device
FcmTokenSchema.index({ userId: 1, deviceId: 1 }, { unique: true });
FcmTokenSchema.index({ userId: 1 });
FcmTokenSchema.index({ deviceId: 1 });         // for deactivating others on login
module.exports = mongoose.model("FcmToken", FcmTokenSchema);