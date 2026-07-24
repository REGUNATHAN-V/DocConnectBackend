// Shared in-memory state for WebSocket connections
const userSockets = new Map(); // code -> ws
const groupOnline = new Map(); // groupId -> Set of online member codes

module.exports = { userSockets, groupOnline };