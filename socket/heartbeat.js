const CodeConnected = require("../models/CodeConnected");
const { userSockets } = require("./socketState");


/**
 * Heartbeat handler — bound to WebSocket `pong` event.
 * Keeps track of whether the client is still alive.
 */
function heartbeat() {
    this.isAlive = true;
  }
  
  /**
   * Starts a ping interval on a WebSocketServer.
   * Terminates sockets that don't respond within the interval.
   *
   * @param {import("ws").WebSocketServer} wss
   * @param {number} intervalMs - default 30 seconds
   * @returns {NodeJS.Timeout} interval reference (call clearInterval on server close)
   */
  function startHeartbeat(wss, intervalMs = 30000) {
    const interval = setInterval(() => {
      wss.clients.forEach(async (ws) => {
        if (ws.isAlive === false) {
          console.log("💀 Terminating inactive socket");
          if (ws._code) {
            userSockets.delete(ws._code);
            await CodeConnected.updateOne(
              { code: ws._code },
              { connected: false, active: false, lastActive: Date.now() }
            );
            console.log(`❎ ${ws._code} marked inactive (heartbeat timeout)`);
          }
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, intervalMs);
  
    wss.on("close", () => clearInterval(interval));
  
    return interval;
  }
  
  module.exports = { heartbeat, startHeartbeat };