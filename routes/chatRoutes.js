// const express = require("express");
// const router = express.Router();
// const ChatUser = require("../models/User");
// const Chat = require("../models/Chat");
// const authMiddleware = require("../middlleware/authmiddleware");
// const { handleAttachmentUpload } = require("../socket/handlers/privateAttachment");


// // Register or update user
// router.post("/register", async (req, res) => {
//   try {
//     const { code, name, user_id, entity_id, entity_name,m_key } = req.body;

//     console.log("📥 Incoming registration:", req.body);

//     // 1. Validate required fields
//     if (!code || !name || !user_id || !m_key) {
//       return res.status(400).json({
//         success: false,
//         message: "Missing required fields: code, name, or user_id",
//       });
//     }


//     //  2. Find existing user by code
//     let user = await ChatUser.findOne({ code });

//     // user check
//         const [mysqlUser] = await mysqlConnection
//         .promise()
//         .query("SELECT * FROM chat_users WHERE code = ?", [code]);

    

//     if (!user) {
//       //  Create new user
//       user = new ChatUser({
//         code,
//         name,
//         user_id,
//         entity_id: entity_id || null,
//         entity_name: entity_name || null,
//         connected: true, // default
//         m_key,
//       });
//       await user.save();
//       console.log("🧍 New user registered:", user.code);

  
//     } else {
//       // Update existing user info only if changed
//       const updatedFields = {};

//       if (user.name !== name) updatedFields.name = name;
//       if (user.entity_id !== entity_id) updatedFields.entity_id = entity_id;
//       if (user.entity_name !== entity_name) updatedFields.entity_name = entity_name;

//       if (Object.keys(updatedFields).length > 0) {
//         await ChatUser.updateOne({ code }, { $set: updatedFields });
//         console.log("♻️ Existing user updated:", user.code);
//       } else {
//         console.log("ℹ️ No changes for user:", user.code);
//       }
//     }

//     // 3. Fetch all users for list (only necessary fields)
//     const allUsers = await ChatUser.find({}, "code name connected");

//     //  4. Send response
//     res.status(200).json({
//       success: true,
//       message: "User registered/updated successfully",
//       users: allUsers,
//     });
//   } catch (err) {
//     console.error("❌ Error registering user:", err);
//     res.status(500).json({
//       success: false,
//       message: "Internal server error",
//     });
//   }
// });



// // Get list of all users
// router.get("/list", async (req, res) => {
//   try {
//     const users = await ChatUser.find({}, "code name connected");
//     res.json({ users });
//   } catch (err) {
//     console.error("❌ Error fetching user list:", err);
//     res.status(500).json({ success: false, message: "Internal server error" });
//   }
// });


// router.get("/chathistory/:sender/:receiver", async (req, res) => {
//   const { sender, receiver } = req.params;
//   const chats = await Chat.find({
//     $or: [
//       { sender, receiver },
//       { sender: receiver, receiver: sender }
//     ]
//   }).sort({ timestamp: 1 });
//   res.json(chats);
// });




// // POST /api/chat/send-attachment
// // multipart/form-data — fields: file, sender, senderName, receiver, receiverName, tempId, messageType, caption
// router.post("/send-attachment", authMiddleware, handleAttachmentUpload);


// module.exports = router;


// routes/chatRoutes.js
//
// Add these two routes to your existing chatRoutes.js (merge with whatever
// is already in that file — don't replace it if it has other chat routes).
// This is what server.js's `app.use("/chat", require("./routes/chatRoutes"))`
// was pointing at with nothing behind /history or /conversations, hence the
// 404s.

const express = require("express");
const router = express.Router();
const { getChatHistory, getConversations } = require("../controllers/chatController");
const authMiddleware = require("../middlleware/authmiddleware");
const { handleAttachmentUpload } = require("../socket/handlers/privateAttachment");


router.get("/history", authMiddleware, getChatHistory);
router.get("/conversations", authMiddleware, getConversations);
router.post("/send-attachment", authMiddleware, handleAttachmentUpload);

module.exports = router;