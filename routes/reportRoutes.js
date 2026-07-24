const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/reportController");
const authMiddleware = require("../middlleware/authmiddleware");
const checkRole = require("../middlleware/checkRole");
const { blockUser, unblockUser, checkBlockStatus, getBlockedUsers,  adminGetAllBlocks,
    adminUnblockUser,
    adminGetUserBlocks, } = require("../controllers/blockController");



// User
router.post("/report", authMiddleware, ctrl.reportUser);

// Admin
router.get("/admin/reports",                       authMiddleware, checkRole(2), ctrl.getAllReports);
router.get("/admin/reports/stats",                 authMiddleware, checkRole(2), ctrl.getReportStats);
router.get("/admin/reports/:id",                   authMiddleware, checkRole(2), ctrl.getReportById);
router.patch("/admin/reports/:id/dismiss",         authMiddleware, checkRole(2), ctrl.dismissReport);
router.patch("/admin/reports/:id/warn",            authMiddleware, checkRole(2), ctrl.warnUser);
router.patch("/admin/reports/:id/ban",             authMiddleware, checkRole(2), ctrl.banUser);
router.patch("/admin/users/:userId/unban",         authMiddleware, checkRole(2), ctrl.unbanUser);
router.get("/admin/users/:userId/moderation",      authMiddleware, checkRole(2), ctrl.getUserModerationHistory);

router.post("/block",              authMiddleware, blockUser);
router.delete("/block/:blockedId", authMiddleware, unblockUser);
router.get("/block/check/:otherId",authMiddleware, checkBlockStatus);
router.get("/block/list",          authMiddleware, getBlockedUsers);

// ── Admin routes (role 2 only) ────────────────────────────────────────────
router.get   ("/admin/blocks",               authMiddleware, checkRole(2), adminGetAllBlocks);
router.delete("/admin/blocks/unblock",       authMiddleware, checkRole(2), adminUnblockUser);
router.get   ("/admin/blocks/user/:userId",  authMiddleware, checkRole(2), adminGetUserBlocks);


module.exports = router;