const mongoose = require("mongoose");

const codeconnectedSchema = new mongoose.Schema({
  code: {
    type: String,
    unique: true,
    required: true,
  },
  connected: {
    type: Boolean,
    default: false,
  },

  connectedAt:{
    type:Date,
  },

  active: {
    type: Boolean,
    default: false,
  },

  notify: {
    type: Boolean,
    default: true,
  },
  

  lastActive:{
    type:Date,
    default:Date.now()
  }

});

module.exports = mongoose.model("codeconnected", codeconnectedSchema, "code_connected");

