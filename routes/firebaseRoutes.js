const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");
const FcmToken = require("../models/FcmToken");
// const PendingLogin = require("../models/PendingLogin")

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}


// router.post("/savetoken", async (req, res) => {
//   console.log("\n========== /savetoken HIT ==========");
//   console.log("⏰ Time:", new Date().toISOString());
//   console.log("📦 Raw body:", req.body);

//   try {
//     let { token, userId, deviceId, deviceName, location } = req.body;

//     // ── Clean inputs ──────────────────────────────────────────────
//     token      = token?.trim();
//     userId     = userId?.trim() || null;
//     deviceId   = deviceId?.trim();
//     deviceName = deviceName?.trim();

//     console.log("🧹 Cleaned inputs:", {
//       token:      token ? token.slice(0, 20) + "..." : null,
//       userId,
//       deviceId,
//       deviceName,
//       location,
//     });

//     // ── Validation ────────────────────────────────────────────────
//     if (!token || !deviceId) {
//       console.log("❌ Validation failed — missing token or deviceId");
//       return res.status(400).json({
//         success: false,
//         message: "Missing required fields",
//       });
//     }

//     if (!userId) {
//       console.log("⚠️ No userId provided — skipping save");
//       return res.json({ success: true, message: "No user yet — skipped" });
//     }

//     // ── Step 1: Check existing records before any write ──────────
//     console.log("\n🔍 Step 1: Checking existing DB records...");

//     const existingForDevice = await FcmToken.find({ deviceId });
//     console.log(`📊 Records with deviceId "${deviceId}":`, 
//       existingForDevice.map(r => ({
//         userId:    r.userId,
//         token:     r.token?.slice(0, 20) + "...",
//         isActive:  r.isActive,
//       }))
//     );

//     const existingForUser = await FcmToken.findOne({ userId, deviceId });
//     console.log(`📊 Existing record for userId "${userId}" + deviceId "${deviceId}":`,
//       existingForUser
//         ? { token: existingForUser.token?.slice(0, 20) + "...", isActive: existingForUser.isActive }
//         : "none"
//     );

//     // ── Step 2: Deactivate other users on this device ─────────────
//     console.log("\n🔄 Step 2: Deactivating other users on this device...");
//     console.log("   Query:", { deviceId, userId: { $ne: userId } });

//     const deactivateResult = await FcmToken.updateMany(
//       { deviceId, userId: { $ne: userId } },
//       { $set: { isActive: false } }
//     );

//     console.log("✅ Deactivate result:", {
//       matched:  deactivateResult.matchedCount,
//       modified: deactivateResult.modifiedCount,
//     });

//     // ── Step 3: Upsert current user ───────────────────────────────
//     console.log("\n💾 Step 3: Upserting current user record...");
//     console.log("   Filter:", { userId, deviceId });
//     console.log("   Update:", {
//       token:      token.slice(0, 20) + "...",
//       deviceName,
//       location,
//       isActive: true,
//     });

//     const upsertResult = await FcmToken.findOneAndUpdate(
//       { userId, deviceId },
//       { token, deviceName, location, isActive: true },
//       { upsert: true, new: true, setDefaultsOnInsert: true }
//     );

//     console.log("✅ Upsert result:", {
//       _id:       upsertResult._id,
//       userId:    upsertResult.userId,
//       deviceId:  upsertResult.deviceId,
//       token:     upsertResult.token?.slice(0, 20) + "...",
//       isActive:  upsertResult.isActive,
//       createdAt: upsertResult.createdAt,
//       updatedAt: upsertResult.updatedAt,
//     });

//     // ── Step 4: Final DB state for this device ────────────────────
//     console.log("\n📋 Step 4: Final DB state for this device:");
//     const finalState = await FcmToken.find({ deviceId });
//     finalState.forEach((r, i) => {
//       console.log(`   [${i + 1}] userId: ${r.userId} | token: ${r.token?.slice(0, 20)}... | isActive: ${r.isActive}`);
//     });

//     console.log("\n✅ /savetoken completed successfully");
//     console.log("=====================================\n");

//     return res.json({ success: true, message: "Token saved, user set as active" });

//   } catch (err) {
//     console.error("\n🔥 ERROR in /savetoken:");
//     console.error("   Message:", err.message);
//     console.error("   Code:",    err.code);      // 11000 = duplicate key

//     // ── Duplicate key — tells you exactly which field conflicted ──
//     if (err.code === 11000) {
//       console.error("❌ Duplicate key conflict on:", err.keyValue);
//       console.error("   This means an index is blocking the insert.");
//       console.error("   Run: db.fcmtokens.getIndexes() to check indexes.");
//       return res.status(409).json({
//         success: false,
//         message: "Duplicate key error",
//         conflict: err.keyValue,
//       });
//     }

//     console.error("   Stack:", err.stack);
//     console.error("=====================================\n");
//     return res.status(500).json({ success: false, error: err.message });
//   }
// });

router.post("/savetoken", async (req, res) => {
  console.log("\n========== /savetoken HIT ==========");
  console.log("⏰ Time:", new Date().toISOString());
  console.log("📦 Raw body:", req.body);

  try {
    let { token, userId, deviceId, deviceName, location } = req.body;

    // ── Clean inputs ──────────────────────────────────────────────
    token      = token?.trim();
    userId     = userId?.trim() || null;
    deviceId   = deviceId?.trim();
    deviceName = deviceName?.trim();

    console.log("🧹 Cleaned inputs:", {
      token:      token ? token.slice(0, 20) + "..." : null,
      userId,
      deviceId,
      deviceName,
      location,
    });

    // ── Validation ────────────────────────────────────────────────
    if (!token || !deviceId) {
      console.log("❌ Validation failed — missing token or deviceId");
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // ── No userId flow ────────────────────────────────────────────
    if (!userId) {
      console.log("⚠️ No userId provided");

      const deviceRecords = await FcmToken.find({ deviceId });
      console.log(`📊 Found ${deviceRecords.length} record(s) for deviceId: ${deviceId}`);

      if (deviceRecords.length === 0) {
        // Brand new device — create anonymous record
        console.log("📥 New device — creating anonymous record");
        await FcmToken.create({
          token,
          deviceId,
          deviceName,
          location: location || null,
          userId:   null,
          isActive: false,
        });
        console.log("✅ Anonymous record created");
        return res.json({ success: true, message: "Anonymous token saved for new device" });
      }

      // Device exists — update token on ALL records for this deviceId
      console.log("🔄 Device known — updating token on ALL records for deviceId:", deviceId);
      const syncResult = await FcmToken.updateMany(
        { deviceId },
        { $set: { token, deviceName } }
      );
      console.log("✅ Sync result:", {
        matched:  syncResult.matchedCount,
        modified: syncResult.modifiedCount,
      });

      // Log final state
      const updatedRecords = await FcmToken.find({ deviceId });
      updatedRecords.forEach((r, i) => {
        console.log(`   [${i + 1}] userId: ${r.userId} | token: ${r.token?.slice(0, 20)}... | isActive: ${r.isActive}`);
      });

      return res.json({ success: true, message: `Token synced on ${syncResult.modifiedCount} record(s)` });
    }

    // ── userId present flow ───────────────────────────────────────

    // ── Step 1: Check existing records ───────────────────────────
    console.log("\n🔍 Step 1: Checking existing DB records...");

    const existingForDevice = await FcmToken.find({ deviceId });
    console.log(`📊 Records with deviceId "${deviceId}":`,
      existingForDevice.map(r => ({
        userId:   r.userId,
        token:    r.token?.slice(0, 20) + "...",
        isActive: r.isActive,
      }))
    );

    const existingForUser = await FcmToken.findOne({ userId, deviceId });
    console.log(`📊 Existing record for userId "${userId}" + deviceId "${deviceId}":`,
      existingForUser
        ? { token: existingForUser.token?.slice(0, 20) + "...", isActive: existingForUser.isActive }
        : "none"
    );

    // ── Step 2: Delete anonymous record for this device ───────────
    console.log("\n🗑️ Step 2: Removing anonymous record if exists...");
    const deleteAnon = await FcmToken.deleteOne({ deviceId, userId: null });
    console.log("✅ Anonymous record deleted:", deleteAnon.deletedCount);

    // ── Step 3: Deactivate other users on this device ─────────────
    console.log("\n🔄 Step 3: Deactivating other users on this device...");
    console.log("   Query:", { deviceId, userId: { $ne: userId } });

    const deactivateResult = await FcmToken.updateMany(
      { deviceId, userId: { $ne: userId } },
      { $set: { isActive: false } }
    );

    console.log("✅ Deactivate result:", {
      matched:  deactivateResult.matchedCount,
      modified: deactivateResult.modifiedCount,
    });

    // ── Step 4: Upsert current user ───────────────────────────────
    console.log("\n💾 Step 4: Upserting current user record...");
    console.log("   Filter:", { userId, deviceId });
    console.log("   Update:", {
      token:      token.slice(0, 20) + "...",
      deviceName,
      location,
      isActive: true,
    });

    const upsertResult = await FcmToken.findOneAndUpdate(
      { userId, deviceId },
      { $set: { token, deviceName, location, isActive: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log("✅ Upsert result:", {
      _id:       upsertResult._id,
      userId:    upsertResult.userId,
      deviceId:  upsertResult.deviceId,
      token:     upsertResult.token?.slice(0, 20) + "...",
      isActive:  upsertResult.isActive,
      createdAt: upsertResult.createdAt,
      updatedAt: upsertResult.updatedAt,
    });

    // ── Step 5: Final DB state for this device ────────────────────
    console.log("\n📋 Step 5: Final DB state for this device:");
    const finalState = await FcmToken.find({ deviceId });
    finalState.forEach((r, i) => {
      console.log(`   [${i + 1}] userId: ${r.userId} | token: ${r.token?.slice(0, 20)}... | isActive: ${r.isActive}`);
    });

    console.log("\n✅ /savetoken completed successfully");
    console.log("=====================================\n");

    return res.json({ success: true, message: "Token saved, user set as active" });

  } catch (err) {
    console.error("\n🔥 ERROR in /savetoken:");
    console.error("   Message:", err.message);
    console.error("   Code:",    err.code);

    if (err.code === 11000) {
      console.error("❌ Duplicate key conflict on:", err.keyValue);
      console.error("   This means an index is blocking the insert.");
      console.error("   Run: db.fcmtokens.getIndexes() to check indexes.");
      return res.status(409).json({
        success: false,
        message: "Duplicate key error",
        conflict: err.keyValue,
      });
    }

    console.error("   Stack:", err.stack);
    console.error("=====================================\n");
    return res.status(500).json({ success: false, error: err.message });
  }
});

  

// Get tokens for a user
router.get("/tokens/:userId", async (req, res) => {

    console.log("Hit the api")
  const { userId } = req.params;


  try {
    const tokens = await FcmToken.find({ userId }, { _id: 0, token: 1 });
    res.json({ success: true, tokens });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Send notification to a single token
router.post("/notify", async (req, res) => {
  const { token, title, body } = req.body;

  try {
    const message = { notification: { title, body }, token };
    const response = await admin.messaging().send(message);
    res.json({ success: true, response });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send notification to all tokens of a user



router.post("/notifyuser", async (req, res) => {
    const { userId, title, body } = req.body;
    console.log(" /notifyuser called");
    console.log("Request body:", req.body);
  
    try {
      const tokensData = await FcmToken.find({ userId, isActive: true  });
      console.log(`Found ${tokensData.length} token(s) for userId=${userId}:`, tokensData);
  
      const tokens = tokensData.map(t => t.token);
      console.log("Extracted tokens:", tokens);
  
      if (tokens.length === 0) {
        console.log("No tokens found for this user");
        return res.status(404).json({ success: false, message: "No tokens found" });
      }
  
      const message = {
        notification: { title, body },
        tokens: tokens,
      };
      console.log("Prepared message object:", message);
  
      // Use the correct Firebase Admin SDK method
      const response = await admin.messaging().sendEachForMulticast(message);
      console.log("Firebase response:", response);
  
      const successCount = response.responses.filter(r => r.success).length;
      const failureCount = response.responses.filter(r => !r.success).length;
      console.log(`Success: ${successCount},Failure: ${failureCount}`);
  
      res.json({ success: true, response, successCount, failureCount });
    } catch (err) {
      console.error("Error sending notification:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });
  

  router.post("/notifyusersecurity", async (req, res) => {
    const { userId, title, body, excludeDeviceId } = req.body;
    console.log("🔹 /notifyusersecurity called with:", { userId, title, body, excludeDeviceId });
  
    try {
      //  Fetch tokens from DB
      const tokensData = await FcmToken.find({ userId, isActive: true  });
      console.log("📦 Tokens found in DB:", tokensData);
  
      if (!tokensData.length) {
        console.log("⚠️ No tokens found for user:", userId);
        return res.status(404).json({ success: false, message: "No tokens found" });
      }
  
      //  Filter out the new device
      const filteredTokens = tokensData.filter(t => t.deviceId !== excludeDeviceId);
      console.log("📱 Filtered tokens (devices to notify):", filteredTokens);
  
      if (!filteredTokens.length) {
        console.log("⚠️ No devices left to notify after excluding new device:", excludeDeviceId);
        return res.status(400).json({ success: false, message: "No devices to notify" });
      }
  
      //  Find info about the new device
      const newDeviceInfo = tokensData.find(t => t.deviceId === excludeDeviceId);
      console.log("🆕 New device info (excluded one):", newDeviceInfo);
  
      const notificationBody = `${body} (New device: ${newDeviceInfo?.deviceName || "Unknown"}, Location: ${newDeviceInfo?.location || "Unknown"})`;
      console.log("📢 Final notification body:", notificationBody);
  
      //  Prepare tokens list
      const tokens = filteredTokens.map(t => t.token);
      console.log("🎯 Tokens to send notification to:", tokens);
  
      //  Send in chunks
      const chunkSize = 500;
      let successCount = 0;
      let failureCount = 0;
  
      for (let i = 0; i < tokens.length; i += chunkSize) {
        const chunk = tokens.slice(i, i + chunkSize);
        console.log(` Sending chunk ${i / chunkSize + 1}:`, chunk.length, "tokens");
  
        const message = {
          notification: { title, body: notificationBody },
          tokens: chunk,
        };
  
        // Try to send notifications
        try {
          const response = await admin.messaging().sendEachForMulticast(message);
          console.log(` Chunk ${i / chunkSize + 1} response:`, response);
  
          const chunkSuccess = response.responses.filter(r => r.success).length;
          const chunkFail = response.responses.filter(r => !r.success).length;
  
          successCount += chunkSuccess;
          failureCount += chunkFail;
  
          console.log(` Chunk ${i / chunkSize + 1} result — Success: ${chunkSuccess}, Failed: ${chunkFail}`);
        } catch (sendErr) {
          console.error(` Error sending chunk ${i / chunkSize + 1}:`, sendErr.message);
        }
      }
  
      //  Final result
      console.log(` Notification summary for user ${userId}: Sent to ${successCount} devices, ${failureCount} failed.`);
  
      res.json({
        success: true,
        message: `Sent to ${successCount} devices, ${failureCount} failed.`,
      });
  
    } catch (err) {
      console.error(" Server error while sending notifications:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });
  



// Send notification to ALL users (every saved token)
router.post("/notifyall", async (req, res) => {
    const { title, body } = req.body;
  
    try {
      const tokensData = await FcmToken.find({isActive: true });
      const tokens = tokensData.map(t => t.token);
  
      if (tokens.length === 0) {
        return res.status(404).json({ success: false, message: "No tokens found in database" });
      }
  
      const chunkSize = 500;
      let successCount = 0;
      let failureCount = 0;
  
      for (let i = 0; i < tokens.length; i += chunkSize) {
        const chunk = tokens.slice(i, i + chunkSize);
  
        const message = {
          notification: { title, body },
          tokens: chunk,
        };
  
        const response = await admin.messaging().sendEachForMulticast(message);
  
        successCount += response.responses.filter(r => r.success).length;
        failureCount += response.responses.filter(r => !r.success).length;
      }
  
      res.json({
        success: true,
        message: `Notification sent to ${successCount} tokens, ${failureCount} failed.`,
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  

//   router.post("/approve-login", async (req, res) => {
//     const { userId, newDeviceId } = req.body;
//     await PendingLogin.findOneAndUpdate(
//         { userId, newDeviceId },
//         { status: "approved" }
//     );
//     res.json({ success: true });
// });

// // Deny login
// router.post("/deny-login", async (req, res) => {
//     const { userId, newDeviceId } = req.body;
//     await PendingLogin.findOneAndUpdate(
//         { userId, newDeviceId },
//         { status: "denied" }
//     );
//     res.json({ success: true });
// });


//
router.post("/verify-login", async (req, res) => {
  const { loginRequestId, action } = req.body;

  const loginRequest = await LoginRequest.findById(loginRequestId);
  if (!loginRequest) return res.status(404).json({ error: "Not found" });

  loginRequest.status = action === "allow" ? "approved" : "denied";
  await loginRequest.save();

  // Notify new device via WebSocket
  notifyNewDevice(loginRequest.newDeviceId, loginRequest.status);

  res.json({ success: true });
});
  

module.exports = router;




