// models/Favorite.js
const mongoose = require("mongoose");

const favoriteSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      ref: "User"
    },
    chatCode: {
      type: String,
      required: true
    },
    isGroup: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

// One favorite entry per user per chat
favoriteSchema.index({ userId: 1, chatCode: 1 }, { unique: true });

module.exports = mongoose.model("Favorite", favoriteSchema); 