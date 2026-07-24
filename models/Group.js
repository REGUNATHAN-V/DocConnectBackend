const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema({
  groupId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  members: [{ type: String, required: true }], // user codes
  admin: { type: String }, // optional: creator or admin code
  createdAt: { type: Date, default: Date.now },
  profilePic: { type: String, default: "" }, 

});

module.exports = mongoose.model("Group", groupSchema);
