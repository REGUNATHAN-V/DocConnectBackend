const mongoose = require("mongoose");

const userWarningSchema = new mongoose.Schema({
  userId:     { type: String, required: true },
  reason:     { type: String, required: true },
  reportId:   { type: String, default: "" },  // which report triggered this
  warnedBy:   { type: String, default: "" },  // admin userId
  note:       { type: String, default: "" },
}, { timestamps: true });

module.exports = mongoose.model("UserWarning", userWarningSchema);