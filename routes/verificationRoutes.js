const express = require("express");
const router = express.Router();
const Verification = require("../models/Verification");
const jwt = require("jsonwebtoken"); 
const admin = require("../services/firebaseService");


// Generate OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP route
router.post("/sendotp", async (req, res) => {
  const { phone, m_key, fcmtoken } = req.body;

  
  console.log("ENtering",req.body)
  if (!phone || !fcmtoken) {
    return res.status(400).json({ error: "Phone or fcmtoken missing" });
  }

  let user = await Verification.findOne({ code: phone });
  const otp = generateOTP();
  const expiry = Date.now() + 2 * 60 * 1000; // 2 minutes expiry

  if (!user) {
    user = new Verification({ code: phone, otp, otpExpires: expiry, m_key, fcmtoken });
  } else {
    user.otp = otp;
    user.otpExpires = expiry;
    user.fcmtoken = fcmtoken;
  }
  await user.save();

  // Send OTP via Firebase Notification
  try {
    await admin.messaging().send({
      token: fcmtoken,
      notification: {
        title: "🔐 Your OTP Code",
        body: `Your verification code is ${otp}`,
      },
      data: { otp },
    });
    console.log(`✅ OTP notification sent to ${phone}`);
  } catch (err) {
    console.error(`❌ FCM Error: ${err.message}`);
  }

  res.json({ success: true, message: "OTP sent successfully" });
});

// Verify OTP
router.post("/verifyotp", async (req, res) => {
    try {
      console.log("📩 Incoming /verifyotp request:", req.body);
  
      const { phone, otp } = req.body;
      if (!phone || !otp) {
        console.log("❌ Missing phone or otp in request");
        return res.status(400).json({ error: "Phone and OTP are required" });
      }
  
      console.log("🔍 Searching for user with code:", phone);
      const user = await Verification.findOne({ code: phone });
  
      if (!user) {
        console.log(`⚠️ No user found for phone: ${phone}`);
        return res.status(404).json({ error: "User not found" });
      }
  
      console.log("✅ User found:", {
        code: user.code,
        otp: user.otp,
        otpExpires: new Date(user.otpExpires).toLocaleString(),
      });
  
      // Compare OTP
      if (user.otp !== otp) {
        console.log(`❌ Invalid OTP. Expected: ${user.otp}, Got: ${otp}`);
        return res.status(400).json({ error: "Invalid OTP" });
      }
  
      // Check expiry
      if (user.otpExpires < Date.now()) {
        console.log("⏰ OTP expired at:", new Date(user.otpExpires).toLocaleString());
        return res.status(400).json({ error: "OTP expired" });
      }
  
      console.log("✅ OTP verified successfully for:", phone);
  
      // Clear OTP
      user.otp = null;
      user.otpExpires = null;
      await user.save();
      console.log("🧹 OTP fields cleared in DB");
  
      // Generate JWT
      console.log("🔐 Generating JWT...");
      const token = jwt.sign(
        { id: user._id, code: user.code },
        process.env.JWT_SECRET,
        { expiresIn: "30d" }
      );
      console.log("✅ JWT created successfully:", token);
  
      res.json({
        success: true,
        message: "Login successful",
        user:  user.code,
        token,
      });
  
      console.log("📤 Response sent successfully for phone:", phone);
    } catch (err) {
      console.error("❌ Error in /verifyotp route:", err);
      res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
  });

  router.post('/exponotification', async (req, res) => {
    const { token, title, body } = req.body;
    console.log("hitting", req.body)
  
    if (!token || !title || !body) {
      return res.status(400).json({ error: 'token, title, and body are required' });
    }
  
    const message = {
      to: token,
      sound: 'default',
      title,
      body,
      data: { extraData: 'Some extra info' },
    };
  
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });
  
      const data = await response.json();
      console.log('Expo response:', data);
      res.json({ success: true, response: data });
    } catch (error) {
      console.error('Error sending notification:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  

module.exports = router;
