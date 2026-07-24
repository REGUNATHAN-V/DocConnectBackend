const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      unique: true
    },

    phone: {
      type: String,
      required: true,
      unique: true,
      // sparse: true,
      trim: true,
      // match: [/^\+91[6-9]\d{9}$/, "Invalid Indian phone number"],
    },

    countryCode:{
      type: String,
      default: "+91"
    },


    profilePic: {
      type: String,
      default: "",
    },

    profilePicKey: {
      type: String,
      default: "",
    },

    connected: {
      type: Boolean,
      default: false,
    },

    lastSeen: {
      type: Date,
      default: Date.now,
    },

    userId: {
      type: String,
      unique: true,
      required: true,
    },

    role: {
      type: String,
      // required: true,
      // enum: ["doctor", "nurse", "student"],
    }
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);