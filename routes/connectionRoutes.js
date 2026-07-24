const express = require("express");
const router = express.Router();
const {
  getDiscoverUsers,
  searchUsers,
  searchMyConnections,
  getMyConnections,
  getPendingRequests,
  sendConnectRequest,
  respondToConnectRequest,
  removeConnection,
} = require("../controllers/connectionController");
const authMiddleware = require("../middlleware/authmiddleware");

// "People you may know" (Discover -> All)
router.get("/discover", authMiddleware, getDiscoverUsers);

// Discover -> search bar results
router.get("/search", authMiddleware, searchUsers);

router.get("/searchmyconnection", authMiddleware, searchMyConnections);



// Requests waiting on YOU to accept/decline (feeds the notification bell)
router.get("/requests", authMiddleware, getPendingRequests);

// "Connected accounts" screen (your accepted connections)
router.get("/", authMiddleware, getMyConnections);

router.post("/request", authMiddleware, sendConnectRequest);
router.post("/:connectionId/respond", authMiddleware, respondToConnectRequest);
router.delete("/:connectionId", authMiddleware, removeConnection);

module.exports = router;