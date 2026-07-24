const express = require("express");
const router = express.Router();
const {
  createPost,
  getFeed,
  toggleLike,
  deletePost,
} = require("../controllers/Postcontroller");
const authMiddleware = require("../middlleware/authmiddleware");
const upload = require("../middlleware/upload");

// Feed is read behind auth only so we can flag "likedByMe" per viewer;
// swap to a public route if logged-out browsing is ever needed.
router.get("/feed", authMiddleware, getFeed);

router.post("/create", authMiddleware, upload.array("images", 6), createPost);
router.post("/:postId/like", authMiddleware, toggleLike);
router.delete("/:postId", authMiddleware, deletePost);

module.exports = router;