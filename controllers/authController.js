const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { parsePhoneNumberFromString } = require("libphonenumber-js");
const User = require("../models/User");
const LoginHistory = require("../models/LoginHistory");
const BlacklistedToken = require("../models/BlacklistedToken");
const UserBan = require("../models/UserBan");
const FcmToken = require("../models/FcmToken");
const admin = require("../services/firebaseService");
const { uploadProfilePic, uploadImage, deleteObject } = require("../services/S3service");

const sanitizeUser = (user) => {
  const userData = user.toObject();
  delete userData.__v;
  delete userData.socketId;
  return userData;
};

function splitPhoneNumber(e164) {
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed) {
    throw new Error(`Could not parse phone number: ${e164}`);
  }
  return {
    countryCode: `+${parsed.countryCallingCode}`,
    phone: parsed.nationalNumber,
  };
}


exports.verifyOtp = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ success: false, message: "idToken is required" });
    }

    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
      console.log("decoded-->",decoded)
    } catch (err) {
      console.error("verifyIdToken error:", err.message);
      return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }

    if (!decoded.phone_number) {
      return res.status(400).json({
        success: false,
        message: "This token has no verified phone number attached",
      });
    }

    const { countryCode, phone } = splitPhoneNumber(decoded.phone_number);

    let user = await User.findOne({ countryCode, phone });
    let isNewUser = false;

    if (!user) {
      user = await User.create({
        userId: uuidv4(),
        countryCode,
        phone,
        firebaseUid: decoded.uid,
        status: "active",
      });
      isNewUser = true;
    } 
    
    // else {
    //   const banRecord = await UserBan.findOne({ userId: user.userId, isBanned: true });
    //   if (banRecord) {
    //     const now = new Date();
    //     if (banRecord.isPermanent || !banRecord.banUntil || banRecord.banUntil > now) {
    //       const msg = banRecord.isPermanent
    //         ? "Your account has been permanently banned."
    //         : `Your account is banned until ${banRecord.banUntil.toDateString()}.`;
    //       return res.status(403).json({ success: false, banned: true, message: msg });
    //     }
    //     await UserBan.findOneAndUpdate({ userId: user.userId }, { isBanned: false });
    //   }

    //   if (!user.firebaseUid) {
    //     user.firebaseUid = decoded.uid; // backfill for users created before this field existed
    //   }
    //   if (user.status === "deactive") {
    //     user.status = "active"; // reactivate on successful login
    //   }
    //   await user.save();
    // }

    const token = jwt.sign(
      { name: user.name, userId: user.userId, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "365d" }
    );

    await LoginHistory.create({
      userId: user.userId,
      action: isNewUser ? "register" : "login",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({
      success: true,
      message: "Login successful",
      token,
      isNewUser,
      needsProfileSetup: !user.name,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("verifyOtp error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.completeRegister = async (req, res) => {
  try {
    const { userId } = req.user; // set by authMiddleware
    const { name, role } = req.body;

    if (!name || !role) {
      return res.status(400).json({ success: false, message: "Name and role are required" });
    }

    // if (!["doctor", "nurse", "student"].includes(role)) {
    //   return res.status(400).json({ success: false, message: "Invalid role" });
    // }

    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const existingName = await User.findOne({ name, userId: { $ne: userId } });
    if (existingName) {
      return res.status(400).json({ success: false, message: "Name already taken" });
    }

    user.name = name;
    user.role = role;
    user.status = "active";

    if (req.file) {
      try {
        const result = await uploadProfilePic(req.file.buffer);
        user.profilePic = result.fileUrl;
        user.profilePicKey = result.fileKey;
      } catch (uploadError) {
        console.error("S3 upload error:", uploadError);
      }
    }

    await user.save();

    const token = jwt.sign(
      { name: user.name, userId: user.userId, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "365d" }
    );

    res.status(200).json({
      success: true,
      message: "Registration completed successfully",
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("completeRegister error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


exports.updateProfilePic = async (req, res) => {
  try {
    const { userId } = req.user;
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file provided" });
    }

    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    let result;
    try {
      result = await uploadProfilePic(req.file.buffer);
    } catch (uploadError) {
      console.error("S3 upload error:", uploadError);
      return res.status(500).json({ success: false, message: "Upload failed" });
    }

    const oldKey = user.profilePicKey;

    user.profilePic = result.fileUrl;
    user.profilePicKey = result.fileKey;
    await user.save();

    if (oldKey) {
      deleteObject(oldKey).catch((err) =>
        console.error("Failed to delete old profile pic:", err)
      );
    }

    return res.status(200).json({ success: true, profilePic: result.fileUrl });
  } catch (error) {
    console.error("updateProfilePic error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.user;

    const user = await User.findOneAndUpdate(
      { userId },
      { status: "deactive" },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    await LoginHistory.create({
      userId,
      action: "delete-account",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.status(200).json({ success: true, message: "Account deactivated" });
  } catch (error) {
    console.error("deleteUser error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};



exports.logout = async (req, res) => {
  const token = req.headers.authorization.split(" ")[1];
  const deviceId = req.body.deviceId?.trim();

  try {
    await BlacklistedToken.create({ token, userId: req.user.userId });

    if (deviceId) {
      await FcmToken.deleteOne({ userId: req.user.userId, deviceId });
    }

    await LoginHistory.create({
      userId: req.user.userId,
      action: "logout",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.status(200).json({ success: true, message: "Logout successful" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Logout failed", error: err.message });
  }
};