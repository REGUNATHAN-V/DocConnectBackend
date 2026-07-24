const express = require("express");
const router = express.Router();
const {
  verifyOtp,
  completeRegister,
  updateProfilePic,
  deleteUser,
  logout,
} = require("../controllers/authController");
const authMiddleware = require("../middlleware/authmiddleware");
const upload = require("../middlleware/upload");

// ── Onboarding: Welcome (phone+country, OTP send/verify happen on-device
//    via @react-native-firebase/auth) → verify idToken → Complete Register ──
router.post("/verify-otp", verifyOtp);
router.post("/complete-register", authMiddleware, upload.single("profilePic"), completeRegister);

// ── Post-onboarding ───────────────────────────────────────────────────────────
router.post("/update-profile-pic", authMiddleware, upload.single("profilePic"), updateProfilePic);
router.delete("/delete-user", authMiddleware, deleteUser);
router.post("/logout", authMiddleware, logout);

module.exports = router;