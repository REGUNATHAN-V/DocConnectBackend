const mongoose = require("mongoose");

const pendingDeleteSchema = new mongoose.Schema({
  messageId:   { type: String, required: true },
  sender:      { type: String, required: true },
  receiver:    { type: String, required: true },
  deletedAt:   { type: Date,   required: true },
  deleteType:  { type: String, default: "for_everyone" },
});

module.exports = mongoose.model("PendingDelete", pendingDeleteSchema);