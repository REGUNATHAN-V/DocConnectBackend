const FcmToken = require("../models/FcmToken");
const UserSecuritySettings = require("../models/UserSecuritySettings");
const admin = require("firebase-admin");
const User = require("../models/User");


// GET user security settings
exports.getSecuritySettings = async (req, res) => {
  try {
    const { userId } = req.params;

    const settings = await UserSecuritySettings.findOne({ userId });

    if (!settings) {
      return res.json({
        success: false,
        message: "No settings found"
      });
    }

    res.json({ success: true, data: settings });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// UPDATE toggle settings
// exports.updateToggleSettings = async (req, res) => {
//   try {
//     console.log("📩 Received updateToggleSettings request");
//     console.log("➡ Request Body:", req.body);

//     const { userId, twoStepEnabled, loginAlert } = req.body;

//     if (!userId) {
//       return res.status(400).json({
//         success: false,
//         message: "Missing required field: userId"
//       });
//     }

//     // Fetch current settings
//     const currentSettings = await UserSecuritySettings.findOne({ userId });

//     if (!currentSettings) {
//       return res.status(404).json({
//         success: false,
//         message: "User settings not found"
//       });
//     }

//     let updateData = {};
//     let messages = [];

//     // 👉 Two Step Verification toggle
//     if (typeof twoStepEnabled === "boolean" &&
//         twoStepEnabled !== currentSettings.twoStepEnabled) {
//       updateData.twoStepEnabled = twoStepEnabled;
//       messages.push(
//         twoStepEnabled
//           ? "Two-step verification enabled"
//           : "Two-step verification disabled"
//       );
//     }

//     // 👉 Login Alert toggle
//     if (typeof loginAlert === "boolean" &&
//         loginAlert !== currentSettings.loginAlert) {
//       updateData.loginAlert = loginAlert;
//       messages.push(
//         loginAlert
//           ? "Login alert enabled"
//           : "Login alert disabled"
//       );
//     }

//     // If nothing changed
//     if (Object.keys(updateData).length === 0) {
//       return res.json({
//         success: true,
//         message: "No changes detected"
//       });
//     }

//     console.log("🛠 Update Data to Save:", updateData);

//     const settings = await UserSecuritySettings.findOneAndUpdate(
//       { userId },
//       updateData,
//       { new: true }
//     );

//     console.log("📦 Updated Settings:", settings);

//     return res.json({
//       success: true,
//       message: messages.join(", ")
//     });

//   } catch (error) {
//     console.error("💥 Error in updateToggleSettings:", error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// };

const { sendOtpEmail } = require("../utlis/sendOtpEmail"); // your email util

// exports.updateToggleSettings = async (req, res) => {
//   try {
//     console.log("📩 Received updateToggleSettings request");
//     console.log("➡ Request Body:", req.body);

//     const { userId, twoStepEnabled, loginAlert } = req.body;

//     if (!userId) {
//       return res.status(400).json({
//         success: false,
//         message: "Missing required field: userId"
//       });
//     }

//     const currentSettings = await UserSecuritySettings.findOne({ userId });

//     if (!currentSettings) {
//       return res.status(404).json({
//         success: false,
//         message: "User settings not found"
//       });
//     }

//     let updateData = {};
//     let messages = [];
//     let otpSent = false;

//     // 👉 Two Step Verification toggle
//     if (typeof twoStepEnabled === "boolean" &&
//         twoStepEnabled !== currentSettings.twoStepEnabled) {
//       updateData.twoStepEnabled = twoStepEnabled;
//       const msg = twoStepEnabled
//         ? "Two-step verification enabled"
//         : "Two-step verification disabled";
//       messages.push(msg);

//       // 🔥 Generate OTP and send email
//       const otp = Math.floor(100000 + Math.random() * 900000); // 6-digit OTP
//       await sendOtpEmail(userId, otp, msg); // implement sendOtpEmail(userId, otp, message)
//       otpSent = true;
//     }

//     // 👉 Login Alert toggle
//     if (typeof loginAlert === "boolean" &&
//         loginAlert !== currentSettings.loginAlert) {
//       updateData.loginAlert = loginAlert;
//       messages.push(
//         loginAlert
//           ? "Login alert enabled"
//           : "Login alert disabled"
//       );
//     }

//     if (Object.keys(updateData).length === 0) {
//       return res.json({
//         success: true,
//         message: "No changes detected"
//       });
//     }

//     const settings = await UserSecuritySettings.findOneAndUpdate(
//       { userId },
//       updateData,
//       { new: true }
//     );

//     console.log("📦 Updated Settings:", settings);

//     return res.json({
//       success: true,
//       message: messages.join(", "),
//       otpSent // optional: frontend can know an OTP was sent
//     });

//   } catch (error) {
//     console.error("💥 Error in updateToggleSettings:", error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// };

// toggle only for twostep//
// Step 1: Request to change Two-Step Verification
exports.requestToggleTwoStep = async (req, res) => {
  try {
    const { userId, twoStepEnabled } = req.body;

    if (!userId || typeof twoStepEnabled !== "boolean") {
      return res.status(400).json({ success: false, message: "Invalid input" });
    }

    // Fetch only needed fields (projection → faster)
    const userSettings = await UserSecuritySettings.findOne(
      { userId },
      { twoStepEnabled: 1 }
    );

    const user = await User.findOne({ userId });

    if (!userSettings || !user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // No DB write, no email, no OTP -> fastest path
    if (twoStepEnabled === userSettings.twoStepEnabled) {
      return res.json({
        success: true,
        message: "No change needed",
      });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000);

    // Update only required fields using $set → minimizes database write time
    await UserSecuritySettings.updateOne(
      { userId },
      {
        $set: {
          pendingTwoStepChange: {
            newValue: twoStepEnabled,
            otp,
            requestedAt: new Date(),
          },
        },
      }
    );

    // Send OTP email (non-blocking)
    sendOtpEmail(user.email, otp, twoStepEnabled ? "Enable Two-step" : "Disable Two-step")
      .catch(err => console.error("Email send error:", err));

    return res.json({
      success: true,
      mail:"regunathan450@gmail.com",
      message: "OTP sent to your email. Confirm to apply change.",
    });

  } catch (error) {
    console.error("requestToggleTwoStep error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};



// verify two step

// Step 2: Verify OTP and update
exports.verifyTwoStepOtp = async (req, res) => {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return res.status(400).json({ success: false, message: "Missing userId or otp" });
    }

    const userSettings = await UserSecuritySettings.findOne({ userId });
    if (!userSettings || !userSettings.pendingTwoStepChange) {
      return res.status(400).json({ success: false, message: "No pending change found" });
    }

    // Check OTP match
    if (parseInt(otp) !== userSettings.pendingTwoStepChange.otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    // Apply change
    userSettings.twoStepEnabled = userSettings.pendingTwoStepChange.newValue;
    userSettings.pendingTwoStepChange = undefined; // remove temp field
    await userSettings.save();

    return res.json({
      success: true,
      message: userSettings.twoStepEnabled
        ? "Two-step verification enabled"
        : "Two-step verification disabled"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
};


// only for login alert enabled
exports.updateLoginAlert = async (req, res) => {
  try {
    const { userId, loginAlert } = req.body;

    // 🚨 Validate input quickly
    if (!userId || typeof loginAlert !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Invalid userId or loginAlert value",
      });
    }

    // ⚡ Single, fast atomic update (no extra read query)
    await UserSecuritySettings.updateOne(
      { userId },
      { $set: { loginAlert } },
      { upsert: true }
    );

    return res.json({
      success: true,
      message: loginAlert
        ? "Login alert enabled"
        : "Login alert disabled",
    });

  } catch (error) {
    console.error("updateLoginAlert error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};



// SAVE last verified device
exports.saveVerifiedDevice = async (req, res) => {
  console.log("===== SAVE VERIFIED DEVICE API CALLED =====");
  console.log("⏰ Time:", new Date().toISOString());

  try {
    const { userId, deviceId, deviceName, location } = req.body;

    console.log("📥 Incoming request body:", {
      userId,
      deviceId,
      deviceName,
      location,
    });

    // 1️⃣ Validate input
    if (!userId || !deviceId || !deviceName) {
      console.log("❌ Missing required fields", {
        userId,
        deviceId,
        deviceName,
      });

      return res.status(400).json({
        success: false,
        message: "Missing required fields: userId, deviceId, deviceName",
      });
    }

    // 2️⃣ Create device object
    const deviceObj = {
      deviceId,
      deviceName,
      location,
      verifiedAt: new Date(),
    };

    console.log("📦 Device object prepared:", deviceObj);

    // 3️⃣ Remove existing device (if duplicate)
    console.log("🧹 Removing existing device (if any) with same deviceId...");

    const pullResult = await UserSecuritySettings.findOneAndUpdate(
      { userId },
      { $pull: { verifiedDevices: { deviceId } } },
      { new: true }
    );

    console.log("🧹 Pull result:", pullResult ? "User found & cleaned" : "No existing user/settings");

    // 4️⃣ Add new device + update lastVerifiedDevice
    console.log("💾 Saving new verified device...");

    const settings = await UserSecuritySettings.findOneAndUpdate(
      { userId },
      {
        lastVerifiedDevice: deviceObj,
        $push: { verifiedDevices: deviceObj },
      },
      { new: true, upsert: true }
    );

    console.log("✅ Updated settings:", {
      userId: settings.userId,
      verifiedDevicesCount: settings.verifiedDevices?.length,
      lastVerifiedDevice: settings.lastVerifiedDevice,
    });

    console.log("🎉 Device saved successfully");

    return res.json({
      success: true,
      message: "Device verified and saved successfully",
    });

  } catch (error) {
    console.error("🔥 Error in saveVerifiedDevice:", {
      message: error.message,
      stack: error.stack,
    });

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
  


  // remove devices 
  exports.removeDevice = async (req, res) => {
    console.log("===== REMOVE DEVICE API CALLED =====");
    console.log("⏰ Time:", new Date().toISOString());
  
    try {
      const { userId, deviceId, currentDeviceId } = req.body;
  
      console.log("📥 Request Body:", {
        userId,
        deviceId,
        currentDeviceId,
      });
  
      // 1️⃣ Validate input
      if (!userId || !deviceId || !currentDeviceId) {
        console.log("❌ Missing required fields");
        return res.status(400).json({
          success: false,
          message: "Missing required fields",
        });
      }
  
      // 2️⃣ Fetch settings
      console.log("🔍 Fetching user settings...");
      const settings = await UserSecuritySettings.findOne({ userId });
  
      if (!settings) {
        console.log("❌ User not found");
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }
  
      console.log("✅ Settings found:", {
        verifiedDevices: settings.verifiedDevices,
        lastVerifiedDevice: settings.lastVerifiedDevice,
      });
  
      // 3️⃣ Check if last device
      const isLastDevice =
        settings.verifiedDevices.length === 1 &&
        settings.verifiedDevices[0].deviceId === deviceId &&
        deviceId === currentDeviceId;
  
      console.log("🧠 Is last device?", isLastDevice);
  
      // 4️⃣ LAST DEVICE → OTP FLOW
      if (isLastDevice) {
        console.log("⚠️ Last device detected → OTP required");
  
        const otp = Math.floor(100000 + Math.random() * 900000);
  
        settings.pendingLastDeviceRemoval = {
          otp,
          deviceId,
          requestedAt: new Date(),
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        };
  
        console.log("📩 OTP generated:", otp);
  
        await settings.save();
        console.log("💾 Pending removal saved");
  
        await sendOtpEmail(
          userId,
          otp,
          "confirm removal of your LAST trusted device"
        );
  
        console.log("📧 OTP email sent");
  
        return res.json({
          success: true,
          requiresOtp: true,
          message: "OTP sent to email for last device confirmation",
        });
      }
  
      // 5️⃣ SAFE REMOVE
      console.log("🧹 Removing device:", deviceId);
  
      const beforeCount = settings.verifiedDevices.length;
  
      settings.verifiedDevices = settings.verifiedDevices.filter(
        (d) => d.deviceId !== deviceId
      );
  
      const afterCount = settings.verifiedDevices.length;
  
      console.log("📊 Devices count:", {
        before: beforeCount,
        after: afterCount,
      });
  
      // 6️⃣ Update lastVerifiedDevice
      if (
        settings.lastVerifiedDevice &&
        settings.lastVerifiedDevice.deviceId === deviceId
      ) {
        console.log("🔄 Updating lastVerifiedDevice...");
  
        settings.lastVerifiedDevice =
          settings.verifiedDevices.length > 0
            ? settings.verifiedDevices[settings.verifiedDevices.length - 1]
            : null;
  
        console.log("✅ New lastVerifiedDevice:", settings.lastVerifiedDevice);
      }
  
      await settings.save();
      console.log("💾 Settings saved after removal");
  
      // 7️⃣ FCM Notification
      console.log("📡 Checking FCM token...");
  
      const removeDeviceToken = await FcmToken.findOne({ userId, deviceId });
  
      if (removeDeviceToken) {
        console.log("📲 FCM token found:", removeDeviceToken.token);
  
        const payload = {
          data: { type: "login_result", status: "denied" },
          token: removeDeviceToken.token,
        };
  
        console.log("📤 Sending FCM payload:", payload);
  
        const fcmResponse = await admin.messaging().send(payload);
  
        console.log("🚀 FCM sent successfully:", fcmResponse);
      } else {
        console.log("⚠️ No FCM token found for this device");
      }
  
      console.log("🎉 Device removed successfully");
  
      return res.json({
        success: true,
        message: "Device removed successfully",
      });
  
    } catch (error) {
      console.error("🔥 Error in removeDevice:", {
        message: error.message,
        stack: error.stack,
      });
  
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  // remove lst device using verify
  exports.verifyLastDeviceRemovalOtp = async (req, res) => {
    try {
      const { userId, otp } = req.body;
  
      if (!userId || !otp) {
        return res.status(400).json({
          success: false,
          message: "Missing userId or otp",
        });
      }
  
      const settings = await UserSecuritySettings.findOne({ userId });
  
      if (!settings || !settings.pendingLastDeviceRemoval) {
        return res.status(400).json({
          success: false,
          message: "No pending last-device removal request",
        });
      }
  
      const pending = settings.pendingLastDeviceRemoval;
  
      // ⏱ OTP expiry
      if (pending.expiresAt < new Date()) {
        settings.pendingLastDeviceRemoval = undefined;
        await settings.save();
  
        return res.status(400).json({
          success: false,
          message: "OTP expired. Please request again.",
        });
      }
  
      // 🔐 OTP check
      if (Number(otp) !== pending.otp) {
        return res.status(400).json({
          success: false,
          message: "Invalid OTP",
        });
      }
  
      // ✅ STORE DEVICE ID FIRST (IMPORTANT)
      const removedDeviceId = pending.deviceId;
      console.log("✅ removedDeviceId:", removedDeviceId);
  
      // ✅ Remove device
      settings.verifiedDevices = settings.verifiedDevices.filter(
        d => d.deviceId !== removedDeviceId
      );
  
      settings.lastVerifiedDevice = null;
      settings.twoStepEnabled = false;
      settings.pendingLastDeviceRemoval = undefined;
  
      await settings.save();
  
      // 🔔 FCM — SEND AFTER SUCCESS
      const removedDeviceToken = await FcmToken.findOne({
        userId,
        deviceId: removedDeviceId,
      });
  
      console.log("📲 removedDeviceToken:", removedDeviceToken);
  
      if (removedDeviceToken?.token) {
        await admin.messaging().send({
          token: removedDeviceToken.token,
          data: {
            type: "login_result",
            status: "denied",
          },
        });
      } else {
        console.log("⚠ No FCM token found for removed device");
      }
  
      return res.json({
        success: true,
        message:
          "Last device removed successfully and two-step verification disabled",
      });
  
    } catch (error) {
      console.error("verifyLastDeviceRemovalOtp error:", error);
      return res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  };
  