const mongoose = require("mongoose");

const connectionSchema = new mongoose.Schema(
  {
    connectionId: { type: String, unique: true, required: true },

    // References User.userId (the app's custom uuid, not the Mongo _id) —
    // consistent with how Post.author is stored.
    requester: { type: String, required: true, index: true },
    recipient: { type: String, required: true, index: true },

    status: {
      type: String,
      enum: ["pending", "accepted", "declined"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// A given pair can only ever have one connection record between them.
connectionSchema.index({ requester: 1, recipient: 1 }, { unique: true });

module.exports = mongoose.model("Connection", connectionSchema);