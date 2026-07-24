const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema({
  reportedBy:   { type: String, required: true },
  reportedUser: { type: String, required: true },
  reason:       { type: String, required: true },
  description:  { type: String, default: "" },
  status:       { type: String, default: "pending", enum: ["pending", "reviewed", "dismissed"] },
  action:       { type: String, default: "" },   // warned / banned_7d / banned_permanent
  adminNote:    { type: String, default: "" },
  reviewedBy:   { type: String, default: "" },   // admin userId
  reviewedAt:   { type: Date },
}, { timestamps: true });

reportSchema.index({ reportedBy: 1, reportedUser: 1 }, { unique: true });

module.exports = mongoose.model("Report", reportSchema);