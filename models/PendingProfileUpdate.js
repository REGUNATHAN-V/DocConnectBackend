const mongoose = require("mongoose");

const PendingProfileUpdateSchema = new mongoose.Schema({
  to: { type: String, required: true },         // who should receive the update
  userCode: { type: String, required: true },   // whose pic was updated
  profilePic: { type: String, required: true },
  timestamp: { type: Number, default: Date.now },
});

module.exports = mongoose.model("PendingProfileUpdate", PendingProfileUpdateSchema);