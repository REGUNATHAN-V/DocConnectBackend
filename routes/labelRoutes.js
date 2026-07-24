const express = require("express");
const router  = express.Router();
const authMiddleware = require("../middlleware/authmiddleware");

const {
  getLabels,
  createLabel,
  updateLabel,
  deleteLabel,
  getFavorites,
  toggleFavorite
} = require("../controllers/labelController");

router.get   ("/labels",          authMiddleware, getLabels);
router.post  ("/labels",          authMiddleware, createLabel);
router.put   ("/labels/:labelId", authMiddleware, updateLabel);
router.delete("/labels/:labelId", authMiddleware, deleteLabel);

router.get   ("/favorites",        authMiddleware, getFavorites);
router.post  ("/favorites/toggle", authMiddleware, toggleFavorite);

module.exports = router;

