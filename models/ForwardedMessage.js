// ─────────────────────────────────────────────────────────────────────────────
//  models/ForwardedMessage.js
//
//  One row per forward hop.
//  e.g. A→B, then B forwards to C and D → 3 rows total.
//
//  originalMessageId  always points to the very first Chat document.
//  forwardedMessageId points to the new Chat document created for this hop.
// ─────────────────────────────────────────────────────────────────────────────
const mongoose = require("mongoose");

const forwardedMessageSchema = new mongoose.Schema({
  // The Chat doc that was the source for this particular forward action
  sourceMessageId: { type: mongoose.Schema.Types.ObjectId, ref: "Chat", required: true },

  // The very first message in the chain (never changes, no matter how many hops)
  originalMessageId: { type: mongoose.Schema.Types.ObjectId, ref: "Chat", required: true, index: true },
  originalSender:    { type: String, required: true },  // userId of the very first sender

  // Who performed this forward
  forwardedBy:     { type: String, required: true },
  forwardedByName: { type: String, default: "" },

  // Who received this forwarded copy
  forwardedTo:     { type: String, required: true },
  forwardedToName: { type: String, default: "" },

  // The NEW Chat document that was created for this hop
  forwardedMessageId: { type: mongoose.Schema.Types.ObjectId, ref: "Chat", required: true },

  forwardedAt: { type: Number, default: () => Date.now() },

  // How deep in the chain is this hop? (1 = first forward, 2 = re-forward, …)
  hopNumber: { type: Number, default: 1 },
});

// Quickly count total forwards of the original message
forwardedMessageSchema.index({ originalMessageId: 1 });
// Quickly find all messages a user has forwarded
forwardedMessageSchema.index({ forwardedBy: 1 });

module.exports = mongoose.model("ForwardedMessage", forwardedMessageSchema);