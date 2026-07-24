// const { userSockets } = require("../socketState");
// const Token = require("../../models/FcmToken");
// const admin = require("../../services/firebaseService");

// async function handleCallOffer(ws, parsed) {
//   const { sender, senderName, receiver, sdp, isVideo, callId } = parsed;
//   const recvSock = userSockets.get(receiver);

//   if (recvSock?.readyState === 1) {
//     recvSock.send(JSON.stringify({
//       type: "incoming_call", callId, sender, senderName,
//       isVideo: !!isVideo, sdp,
//     }));
//   } else {
//     const tokenDoc = await Token.findOne({ userId: receiver });
//     if (tokenDoc?.token) {
//       try {
//         await admin.messaging().send({
//           token: tokenDoc.token,
//           notification: {
//             title: `Missed call from ${senderName || sender}`,
//             body: isVideo ? "Video call" : "Voice call",
//           },
//           data: { type: "missed_call", sender, callId },
//         });
//       } catch (err) {
//         console.error(`❌ FCM missed call error: ${err.message}`);
//       }
//     }
//   }
// }

// function handleCallAnswer(ws, parsed) {
//   const { to: receiver, sdp, callId } = parsed;
//   const origSock = userSockets.get(receiver);
//   if (origSock?.readyState === 1) {
//     origSock.send(JSON.stringify({ type: "call_answer", callId, sdp }));
//   }
// }

// function handleIceCandidate(ws, parsed) {
//   const { to, candidate, callId, from } = parsed;
//   const toSock = userSockets.get(to);
//   if (toSock?.readyState === 1) {
//     toSock.send(JSON.stringify({ type: "ice_candidate", candidate, callId, from }));
//   }
// }

// function handleCallEnd(ws, parsed) {
//   const { to, callId, from } = parsed;
//   const toSock = userSockets.get(to);
//   if (toSock?.readyState === 1) {
//     toSock.send(JSON.stringify({ type: "call_end", callId, from }));
//   }
// }

// function handleCallRejectOrBusy(ws, parsed) {
//   const { to, callId, from } = parsed;
//   const toSock = userSockets.get(to);
//   if (toSock?.readyState === 1) {
//     toSock.send(JSON.stringify({ type: parsed.type, callId, from }));
//   }
// }

// module.exports = {
//   handleCallOffer,
//   handleCallAnswer,
//   handleIceCandidate,
//   handleCallEnd,
//   handleCallRejectOrBusy,
// };


// new

const { userSockets } = require("../socketState");
const Token = require("../../models/FcmToken");
const admin = require("../../services/firebaseService");

async function handleCallOffer(ws, parsed) {
  const { sender, senderName, receiver, sdp, isVideo, callId } = parsed;
  const recvSock = userSockets.get(receiver);

  // Always send FCM so the call screen appears regardless of which screen receiver is on
  const tokenDoc = await Token.findOne({ userId: receiver , isActive: true});

  if (recvSock?.readyState === 1) {
    // Receiver is connected via WebSocket — send WS signal
    recvSock.send(JSON.stringify({
      type: "incoming_call",
      callId,
      sender,
      senderName,
      isVideo: !!isVideo,
      sdp,
    }));

    // Also send FCM so the call screen is triggered even if app is in background/other screen
    if (tokenDoc?.token) {
      try {
        await admin.messaging().send({
          token: tokenDoc.token,
          data: {
            type: "incoming_call",
            callId,
            sender,
            senderName: senderName || sender,
            isVideo: isVideo ? "true" : "false",
            sdp,
          },
          android: {
            priority: "high",
          },
          apns: {
            headers: { "apns-priority": "10" },
          },
        });
      } catch (err) {
        console.error(`❌ FCM incoming call error (online): ${err.message}`);
      }
    }

  } else {
    // Receiver is offline — send missed call notification
    if (tokenDoc?.token) {
      try {
        await admin.messaging().send({
          token: tokenDoc.token,
          data: {
            type: "incoming_call",
            callId,
            sender,
            senderName: senderName || sender,
            isVideo: isVideo ? "true" : "false",
            sdp,
          },
          android: {
            priority: "high",
          },
          apns: {
            headers: { "apns-priority": "10" },
          },
        });
      } catch (err) {
        console.error(`❌ FCM incoming call error (offline): ${err.message}`);
      }
    }
  }
}

function handleCallAnswer(ws, parsed) {
  const { to: receiver, sdp, callId } = parsed;
  const origSock = userSockets.get(receiver);
  if (origSock?.readyState === 1) {
    origSock.send(JSON.stringify({ type: "call_answer", callId, sdp }));
  }
}

function handleIceCandidate(ws, parsed) {
  const { to, candidate, callId, from } = parsed;
  const toSock = userSockets.get(to);
  if (toSock?.readyState === 1) {
    toSock.send(JSON.stringify({ type: "ice_candidate", candidate, callId, from }));
  }
}

function handleCallEnd(ws, parsed) {
  const { to, callId, from } = parsed;
  const toSock = userSockets.get(to);
  if (toSock?.readyState === 1) {
    toSock.send(JSON.stringify({ type: "call_end", callId, from }));
  }
}

function handleCallRejectOrBusy(ws, parsed) {
  const { to, callId, from } = parsed;
  const toSock = userSockets.get(to);
  if (toSock?.readyState === 1) {
    toSock.send(JSON.stringify({ type: parsed.type, callId, from }));
  }
}

module.exports = {
  handleCallOffer,
  handleCallAnswer,
  handleIceCandidate,
  handleCallEnd,
  handleCallRejectOrBusy,
};