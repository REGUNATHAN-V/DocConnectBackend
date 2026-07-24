const express = require("express");
const router = express.Router();
const {getMyProfile, searchUserForChat,searchUserByMobileNumber, searchUser,getOtherProfile, getCommonGroups} = require("../controllers/userController");

const checkRole = require("../middlleware/checkRole");
const authMiddleware = require("../middlleware/authmiddleware");


router.get("/view", authMiddleware, getMyProfile);
router.get("/viewothers", authMiddleware, getOtherProfile);
router.get("/search", authMiddleware, searchUserForChat);
router.get("/searchbyphone", authMiddleware, searchUserByMobileNumber);
router.get("/searchuser", authMiddleware, searchUser);
router.get("/groups/:userId", authMiddleware, getCommonGroups);








module.exports = router;
