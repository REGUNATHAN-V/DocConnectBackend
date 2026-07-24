const express = require("express");
const router = express.Router();
const {getAllUsers, getLoginHistory,editUserProfile} = require("../controllers/adminController");
const checkRole = require("../middlleware/checkRole");
const authMiddleware = require("../middlleware/authmiddleware");

router.get("/registered-users", authMiddleware, checkRole(3), getAllUsers);
router.get("/login-history", authMiddleware, checkRole(3), getLoginHistory);
router.put("/edit-user", authMiddleware, editUserProfile);

module.exports = router;