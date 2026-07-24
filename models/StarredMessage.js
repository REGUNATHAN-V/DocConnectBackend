// ─────────────────────────────────────────────────────────────────────────────
//  models/StarredMessage.js
// ─────────────────────────────────────────────────────────────────────────────
const mongoose = require("mongoose");

const starredMessageSchema = new mongoose.Schema({
  userId:      { type: String, required: true, index: true },  // who starred it
  messageId:   { type: mongoose.Schema.Types.ObjectId, ref: "Chat", required: true },
  sender:      String,   // denormalised for quick display — no join needed
  receiver:    String,
  message:     String,
  messageType: String,
  audioUrl:    String,
  fileUrl:      String,
  fileName:     String,
  timestamp:   Number,   // original message timestamp
  starredAt:   { type: Number, default: () => Date.now() },
});

// A user can only star a given message once
starredMessageSchema.index({ userId: 1, messageId: 1 }, { unique: true });

module.exports = mongoose.model("StarredMessage", starredMessageSchema);