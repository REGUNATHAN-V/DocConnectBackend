// ─────────────────────────────────────────────────────────────────────────────
//  models/DeletedMessage.js
// ─────────────────────────────────────────────────────────────────────────────
const mongoose = require("mongoose");

const deletedMessageSchema = new mongoose.Schema({
  messageId: { type: mongoose.Schema.Types.ObjectId, ref: "Chat", required: true, index: true },
  
  // "for_me"       — only this userId sees it deleted; the other party is unaffected
  // "for_everyone" — content wiped for all; recorded once (no userId needed)
  deleteType: {
    type: String,
    enum: ["for_me", "for_everyone"],
    required: true,
  },

  deletedBy:  { type: String, required: true },  // userId who triggered the delete
  deletedAt:  { type: Number, default: () => Date.now() },

  // Cached from the original Chat so we can show "This message was deleted" without a join
  sender:   String,
  receiver: String,
});

// One "for_me" row per user per message; one "for_everyone" row per message
deletedMessageSchema.index({ messageId: 1, deleteType: 1, deletedBy: 1 }, { unique: true });

module.exports = mongoose.model("DeletedMessage", deletedMessageSchema);