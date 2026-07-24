const mongoose = require("mongoose");

const userBanSchema = new mongoose.Schema({
  userId:      { type: String, required: true, unique: true },
  isBanned:    { type: Boolean, default: true },
  isPermanent: { type: Boolean, default: false },
  banUntil:    { type: Date, default: null },
  banReason:   { type: String, default: "" },
  bannedBy:    { type: String, default: "" },  // admin userId
}, { timestamps: true });

module.exports = mongoose.model("UserBan", userBanSchema);