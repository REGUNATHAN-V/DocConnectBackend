const { WebSocketServer } = require("ws");
const codeConnected = require("../models/CodeConnected");

const { userSockets } = require("./socketState");
const { heartbeat, startHeartbeat } = require("./heartbeat");
const { setWss } = require("./broadcast");

const { handleRegister } = require("./handlers/register");
const { handlePrivateMessage } = require("./handlers/privateMessage");
const { handlePrivateVoice } = require("./handlers/privateVoice");
const { handleCreateGroup } = require("./handlers/groupCreate");
const { handleGroupMessage } = require("./handlers/groupMessage");
const { handleGroupVoice } = require("./handlers/groupVoice");
const { handlePresence, handleGroupPresence } = require("./handlers/presence");
const { handleTyping, handleGroupTyping } = require("./handlers/typing");
const { handleSeen, handleGroupSeen } = require("./handlers/seen");
const { handleDelivered, handleGroupDelivered } = require("./handlers/delivered");
const {
  handleCallOffer,
  handleCallAnswer,
  handleIceCandidate,
  handleCallEnd,
  handleCallRejectOrBusy,
} = require("./handlers/calling");
const { handleUpdateProfilePic } = require("./handlers/updateProfilePic");
const { handlePrivateLocation,handlePrivateContact,handleShareMedia } = require("./handlers/privateAttachment");
const {
  handleStarMessage,
  handleUnstarMessage,
  handleDeleteForMe,
  handleDeleteForEveryone,
  handleGetStarredMessages,
} = require("./handlers/messageActions");

const {
  handleForwardMessage,
  handleGetForwardInfo,
} = require("./handlers/forwardMessage");

/**
 * Initializes the WebSocket server on top of an existing HTTP server.
 *
 * @param {import("http").Server} server
 * @returns {{ wss: import("ws").WebSocketServer }}
 */
function initSocket(server) {
  const wss = new WebSocketServer({ server });

  // Registers this instance with the REST-side broadcast helper so plain
  // controllers (e.g. postController) can push live events without a
  // circular require back into this file.
  setWss(wss);

  startHeartbeat(wss);

  wss.on("connection", (ws) => {
    console.log("🔗 New WebSocket client connected");

    ws.isAlive = true;
    ws._code = null;
    ws.on("pong", heartbeat);

    ws.send(JSON.stringify({
      sender: "Server",
      message: "Connected to WebSocket server",
    }));

    ws.on("message", async (data) => {
      try {
        const parsed = JSON.parse(data);
        console.log("📩 Received:", parsed.type);

        switch (parsed.type) {
          case "register":         return await handleRegister(ws, parsed);
          case "create_group":     return await handleCreateGroup(ws, parsed);
          case "private_message":  return await handlePrivateMessage(ws, parsed);
          case "private_voice":    return await handlePrivateVoice(ws, parsed);
          case "group_message":    return await handleGroupMessage(ws, parsed);
          case "group_voice":      return await handleGroupVoice(ws, parsed);
          case "typing":           return handleTyping(ws, parsed);
          case "group_typing":     return await handleGroupTyping(ws, parsed);
          case "presence":         return await handlePresence(ws, parsed);
          case "group_presence":   return await handleGroupPresence(ws, parsed);
          case "seen":             return await handleSeen(ws, parsed);
          case "group_seen":       return await handleGroupSeen(ws, parsed);
          case "delivered":        return await handleDelivered(ws, parsed);
          case "group_delivered":  return await handleGroupDelivered(ws, parsed);
          case "call_offer":       return await handleCallOffer(ws, parsed);
          case "call_answer":      return handleCallAnswer(ws, parsed);
          case "ice_candidate":    return handleIceCandidate(ws, parsed);
          case "call_end":         return handleCallEnd(ws, parsed);
          case "call_reject":
          case "call_busy":        return handleCallRejectOrBusy(ws, parsed);
          case "update_profile_pic": return await handleUpdateProfilePic(ws, parsed);
          case "private_location": return await handlePrivateLocation(ws, parsed);
          case "private_contact":  return await handlePrivateContact(ws, parsed);
          case "private_shared_media": return await handleShareMedia(ws, parsed); 
          case "ping":             return ws.send(JSON.stringify({ type: "pong" }));
                  // ── ★ star ────────────────────────────────────────────────────────
                  case "star_message":         return await handleStarMessage(ws, parsed);
                  case "unstar_message":       return await handleUnstarMessage(ws, parsed);
                  case "get_starred_messages": return await handleGetStarredMessages(ws, parsed);

                  // ── 🗑 delete ─────────────────────────────────────────────────────
                  case "delete_for_me":        return await handleDeleteForMe(ws, parsed);
                  case "delete_for_everyone":  return await handleDeleteForEveryone(ws, parsed);

                  // ── ↪ forward ─────────────────────────────────────────────────────
                  case "forward_message":   return await handleForwardMessage(ws, parsed);
                  case "get_forward_info":  return await handleGetForwardInfo(ws, parsed);
          default:
            console.log("⚠️ Unknown WS message type:", parsed.type);
        }
      } catch (err) {
        console.error("❌ WebSocket error:", err);
      }
    });

    ws.on("close", async () => {
      const code = ws._code;
      if (code) {
        userSockets.delete(code);
        await codeConnected.updateOne({ code }, { connected: false, active:false, lastActive:Date.now() });
        console.log(`❎ ${code} disconnected`);
      } else {
        console.log("❎ Unknown socket disconnected");
      }
    });

    ws.on("error", (err) => console.error("WS error:", err));
  });

  // NOTE: this used to `return wss;` directly, which meant
  // `const { wss } = initSocket(server)` in server.js was silently
  // destructuring `undefined` (WebSocketServer has no `.wss` property).
  // Returning an object here fixes that call site without touching it.
  return { wss };
}

module.exports = { initSocket, userSockets };