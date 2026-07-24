const mongoose = require("mongoose");

const labelSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      ref: "User"
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    // Each member: { chatCode, isGroup }
    members: [
      {
        chatCode: { type: String, required: true },
        isGroup:  { type: Boolean, default: false }
      }
    ]
  },
  { timestamps: true }
);

// One user cannot have two labels with the same name
labelSchema.index({ userId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Label", labelSchema);