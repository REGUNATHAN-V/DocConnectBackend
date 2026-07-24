const mongoose = require("mongoose");

const userBlockSchema = new mongoose.Schema({
  blockerId: { type: String, required: true }, // who blocked
  blockedId: { type: String, required: true }, // who got blocked
}, { timestamps: true });

userBlockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });

module.exports = mongoose.model("UserBlock", userBlockSchema);