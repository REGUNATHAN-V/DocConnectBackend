const mongoose = require("mongoose");

const groupChatSchema = new mongoose.Schema({
  groupId: { type: String, required: true },
  sender: { type: String, required: true },
  senderName: { type: String, required: true },
  message: { type: String },
  timestamp: { type: Date, default: Date.now },
  audioUrl: String,
  audioId: String, 
  duration: Number,
  messageType:String,
  status: { 
    type: String, 
    enum: ["sent", "delivered", "seen", "pending"], 
    default: "sent" 
  },
  deliveredTo: { type: [
    {
      user: String,
      timestamp: Number
    }
  ],
   default: [] 
  },
  seenBy: {
    type: [
      {
        user: String,
        timestamp: Number
      }
    ],
    default: []
  }

  
});

module.exports = mongoose.model("GroupChat", groupChatSchema);
