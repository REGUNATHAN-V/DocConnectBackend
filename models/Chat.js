// const mongoose = require("mongoose");

// const chatSchema = new mongoose.Schema({
//   sender: String,
//   receiver: String,
//   senderName:String,
//   receiverName:String,
//   message: String,
//   timestamp: Number,
//   audioUrl: String,
//   audioId: String,
//   duration: Number,
//   messageType:String,
//   status: {
//     type: String,
//     enum: ["sent", "delivered", "seen"],
//     default: "sent",
//   },
// });

// module.exports = mongoose.model("Chat", chatSchema);


const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
  // ── existing fields (untouched) ──────────────────────────────────────────
  sender:       String,
  receiver:     String,
  senderName:   String,
  receiverName: String,
  message:      String,
  timestamp:    Number,
  audioUrl:     String,   // voice: S3 public URL
  audioId:      String,   // voice: S3 file key
  duration:     Number,
  messageType:  String,
  // "chat" | "voice" | "image" | "video" | "document" | "audio" | "location" | "contact"
  status: {
    type:    String,
    enum:    ["sent", "delivered", "seen"],
    default: "sent",
  },
  deliveredAt: Number,
  seenAt:      Number,

  // ── NEW: file attachments (image / video / document / audio file) ────────
  fileUrl:      String,   // S3 public URL  — mirrors audioUrl
  fileKey:      String,   // S3 object key  — mirrors audioId
  fileName:     String,   // original filename, e.g. "contract.pdf"
  fileSize:     Number,   // bytes
  fileMimeType: String,   // e.g. "image/jpeg"

  // ── NEW: location ────────────────────────────────────────────────────────
  latitude:  Number,
  longitude: Number,
  address:   String,

  // ── NEW: contact ─────────────────────────────────────────────────────────
  contactName:  String,
  contactPhone: String,

  isForwarded:       { type: Boolean, default: false },
  originalMessageId: { type: mongoose.Schema.Types.ObjectId, ref: "Chat", default: null },
  originalSender:    { type: String, default: null },
 
  // "delete for everyone" needs to be visible to both parties from this table
  // Everything else (per-user delete, star) is in their own tables
  deletedForEveryone: { type: Boolean, default: false },
  deletedAt:          Number,
});

module.exports = mongoose.model("Chat", chatSchema);
