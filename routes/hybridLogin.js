const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const FcmToken = require("../models/FcmToken");
const HybridLoginRequest = require("../models/HybridLoginRequest");
const UserSecuritySettings = require("../models/UserSecuritySettings");

// ✅ Request login from new device
router.post("/requestlogin", async (req, res) => {
  console.log("🚀 /requestlogin API HIT");

  const { userId, newDeviceId, newDeviceName, newDeviceLocation, newDeviceToken } = req.body;

  console.log("📥 Request Body:", JSON.stringify(req.body, null, 2));

  // 🔍 Validate input
  if (!userId || !newDeviceId) {
    console.log("❌ Missing required fields", { userId, newDeviceId });

    return res.status(400).json({
      success: false,
      message: "Missing required fields"
    });
  }

  try {
    // 🆕 Create login request
    console.log("📝 Creating HybridLoginRequest...");
    const request = await HybridLoginRequest.create({
      userId,
      newDeviceId,
      newDeviceName,
      newDeviceLocation,
      newDeviceToken,
      status: "pending",
    });

    console.log("✅ Login Request Created:", request._id);

    // 🔐 Get last verified device
    console.log("🔍 Fetching last verified device...");
    const lastVerifiesDevice = await UserSecuritySettings.findOne({ userId });

    if (!lastVerifiesDevice || !lastVerifiesDevice.lastVerifiedDevice) {
      console.log("❌ No last verified device found for user:", userId);
      return res.status(200).json({
        success: false,
        message: "No verified device found"
      });
    }

    const deviceId = lastVerifiesDevice.lastVerifiedDevice.deviceId;
    console.log("📱 Last Verified Device ID:", deviceId);

    // 📲 Get tokens for last verified device
    console.log("🔍 Fetching FCM tokens...");
    const tokensData = await FcmToken.find({ deviceId,isActive: true });

    console.log("📦 Tokens Data:", JSON.stringify(tokensData, null, 2));

    const tokens = tokensData.map(t => t.token);
    console.log("📨 Tokens List:", tokens);

    // 📤 Send notification to OLD device
    if (tokens.length > 0) {
      console.log("📤 Sending FCM to OLD device(s)...");

      const message = {
        data: {
          type: "login_verification",
          status: "approver",
          loginRequestId: request._id.toString(),
          newDeviceId,
          newDeviceName,
          newDeviceLocation,
        },
        tokens,
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      console.log("✅ FCM sent to OLD devices:", response);
    } else {
      console.log("⚠️ No tokens found for OLD device");
    }

    // 💾 Save current login request ID
    console.log("💾 Updating currentLoginRequestId...");
    await HybridLoginRequest.updateOne(
      { userId },
      { $set: { currentLoginRequestId: request._id.toString() } }
    );

    console.log("🔍 New Device Token from request:", newDeviceToken);

    // 📤 Send notification to NEW device
    if (newDeviceToken) {
      console.log("📤 Sending FCM to NEW device...");

      await admin.messaging().send({
        data: {
          type: "login_verification",
          status: "asker",
          lastDeviceName: lastVerifiesDevice.lastVerifiedDevice.deviceName,
          lastDeviceId: lastVerifiesDevice.lastVerifiedDevice.deviceId
        },
        token: newDeviceToken,
      });

      console.log("✅ FCM sent to NEW device");
    } else {
      console.log("⚠️ No newDeviceToken provided");
    }

    console.log("🎉 API SUCCESS");

    res.json({
      success: true,
      loginRequestId: request._id
    });

  } catch (err) {
    console.error("💥 ERROR in /requestlogin:");
    console.error(err);
    console.error("Stack:", err.stack);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ✅ Approve login
// =============================================
// APPROVE LOGIN
// =============================================
router.post("/approvelogin", async (req, res) => {
  console.log("🚀 /approvelogin HIT");
  console.log("📩 BODY:", req.body);

  try {
    const { loginRequestId, approvingDeviceId } = req.body;

    if (!loginRequestId || !approvingDeviceId) {
      console.log("❌ Missing fields");
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    console.log("🔍 Finding & Updating HybridLoginRequest...");
    const request = await HybridLoginRequest.findByIdAndUpdate(
      loginRequestId,
      {
        status: "approved",
        approvedByDeviceId: approvingDeviceId,
        approvedAt: new Date(),
      },
      { new: true }
    );

    console.log("📦 Updated Request:", request);

    if (!request) {
      console.log("❌ Request ID not found");
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    // 🔔 Notify new device
    console.log("🔍 Looking for NEW device token:", request.newDeviceId);

    // --------------ENABLE NOT WORKING ----------------
    // const newDeviceToken = await FcmToken.findOne({
    //   userId: request.userId,
    //   deviceId: request.newDeviceId
    // });

    // 1. Fetch the login request using the actual primary key `_id`
const requestDoc = await HybridLoginRequest.findById(loginRequestId);

if (!requestDoc) {
  console.log("❌ HybridLoginRequest not found");
  return res.status(404).json({ success: false, message: "Invalid loginRequestId" });
}

// 2. Extract new device token directly
const newDeviceToken = requestDoc.newDeviceToken;

    console.log("📱 New Device Token:", newDeviceToken);

    if (newDeviceToken) {
      console.log("📤 Sending FCM to NEW device...");
      await admin.messaging().send({
        data: { type: "login_result", status: "approved", },
        token: newDeviceToken,
      }).then(() => console.log("✅ FCM Sent to new device"))
        .catch(err => console.log("❌ FCM Error new device:", err));
    }

    // 🔔 Notify older device
    console.log("🔍 Looking for OLD device token:", approvingDeviceId);
    const oldDeviceToken = await FcmToken.findOne({
      userId: request.userId,
      deviceId: approvingDeviceId
    });

    console.log("📱 Old Device Token:", oldDeviceToken);

    if (oldDeviceToken) {
      console.log("📤 Sending FCM to OLD device...");
      await admin.messaging().send({
        notification: { title: "Login Approved", body: "You approved login for a new device." },
        token: oldDeviceToken.token,
      }).then(() => console.log("✅ FCM Sent to old device"))
        .catch(err => console.log("❌ FCM Error old device:", err));
    }

    return res.json({ success: true, request });
  } catch (err) {
    console.error("💥 ERROR:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});


// ✅ Deny login
router.post("/denylogin", async (req, res) => {
  try {
    console.log("1234567890")

    const { loginRequestId, denyingDeviceId } = req.body;
    if (!loginRequestId || !denyingDeviceId) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const request = await HybridLoginRequest.findByIdAndUpdate(
      loginRequestId,
      { status: "denied", approvedByDeviceId: denyingDeviceId, approvedAt: new Date() },
      { new: true }
    );

    if (!request) return res.status(404).json({ success: false, message: "Request not found" });

    // Notify new device
    // const newDeviceToken = await FcmToken.findOne({ userId: request.userId, deviceId: request.newDeviceId });

        // 1. Fetch the login request using the actual primary key `_id`
        const requestDoc = await HybridLoginRequest.findById(loginRequestId);

        if (!requestDoc) {
          console.log("❌ HybridLoginRequest not found");
          return res.status(404).json({ success: false, message: "Invalid loginRequestId" });
        }

        // 2. Extract new device token directly
        const newDeviceToken = requestDoc.newDeviceToken;

    if (newDeviceToken) {
      await admin.messaging().send({
        data: { type: "login_result", status: "denied" },
        token: newDeviceToken,
      });
    }

    // Notify older device (confirmation)
    const oldDeviceToken = await FcmToken.findOne({ userId: request.userId, deviceId: denyingDeviceId });
    if (oldDeviceToken) {
      await admin.messaging().send({
        notification: { title: "Login Denied", body: "You denied login for a new device." },
        token: oldDeviceToken.token,
      });
    }

    res.json({ success: true, request });
  } catch (err) {
    console.error("💥 Error in /denylogin:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// login Alerts 
router.post("/loginalerts", async (req, res) => {
  const { userId, newDeviceId, newDeviceName, newDeviceLocation } = req.body;
  if (!userId || !newDeviceId) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  
// 1. Get user security settings


let settings = await UserSecuritySettings.findOne({ userId });

if (!settings) {
  settings = await UserSecuritySettings.create({ userId });
  console.log("✨ Created default UserSecuritySettings");
}

// 2. If login alert is disabled → stop
if (!settings.loginAlert) {
  console.log("🔕 Login alerts disabled → skipping notifications");
  return res.json({ success: true, message: "Login alert is OFF" });
}



try{



    // this is login alerts notify to all old devices
      // Notify older devices (excluding new device)
    const tokensData = await FcmToken.find({ userId, deviceId: { $ne: newDeviceId },isActive: true  });
    const tokens = tokensData.map(t => t.token);

    
    if (tokens.length > 0) {
      const message = {
        data: {
          type: "login_alert",
          status: "notifyalldevices",
          newDeviceId,
          newDeviceName,
          newDeviceLocation,
        },
        tokens,
      };
      await admin.messaging().sendEachForMulticast(message);
    }

    res.json({ success: true, message:"Successfully Notify all Devices" });
  }
  catch{
    console.error("💥 Error to send loginalert to all devices:", err);
    res.status(500).json({ success: false, error: err.message });
  }

});

module.exports = router;
