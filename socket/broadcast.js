// Small bridge that lets plain REST controllers push events to every
// connected WebSocket client without importing the whole socket module
// (avoids circular requires between socket/index.js and controllers).

let wssInstance = null;

function setWss(wss) {
  wssInstance = wss;
}

/**
 * Broadcasts a JSON-serializable payload to every currently-open socket.
 * Safe to call even if the socket server hasn't been wired up yet.
 */
function broadcastAll(payload) {
  if (!wssInstance) return;
  const data = JSON.stringify(payload);
  wssInstance.clients.forEach((ws) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(data);
    }
  });
}

module.exports = { setWss, broadcastAll };