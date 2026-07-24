const jwt = require("jsonwebtoken");
const User = require("../models/User");
const admin = require("../services/firebaseService");
const verifyGoogleToken = require("../services/googleService");
const { v4: uuidv4 } = require("uuid");



exports.googleAuth = async (req, res) => {
  try {
    console.log("📥 Incoming Request Body:", req.body);

    const { idToken } = req.body;

    if (!idToken) {
      console.log("❌ No idToken received");
      return res.status(400).json({ message: "Token required" });
    }

    console.log("✅ idToken received:", idToken);

    // Verify Google Token
    const payload = await verifyGoogleToken(idToken);
    console.log("🔍 Google Payload:", payload);

    const { email, name, picture } = payload;

    console.log("📧 Email:", email);
    console.log("👤 Name:", name);
    console.log("🖼 Picture:", picture);

    // Check existing user 

    // NOTE : Change the model USER
    
    let user = await User.findOne({ email });

    if (!user) {
      console.log("🆕 Creating New User...");
      user = await User.create({
        email,
        name,
        profilePic: picture,
        provider: "google",
        userId: uuidv4()
      });
      console.log("✅ New User Created:", user);
    } else {
      console.log("♻️ User already exists");
    }

    

    console.log("🔐 Generating JWT...");
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "365d" }
    );

    console.log("🎟 JWT Token:", token);

//     const bcrypt = require("bcrypt");
// const hashedPassword = await bcrypt.hash(password, 10);

    res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        profilePic: user.profilePic,
        // password: hashedPassword,
        role: user.role
      }
    });

    console.log("🚀 Response Sent Successfully");

  } catch (err) {
    console.log("❌ ERROR OCCURRED:");
    console.log("Message:", err.message);
    console.log("Stack:", err.stack);

    res.status(401).json({ message: "Authentication failed" });
  }
};


exports.phoneAuth = async (req, res) => {
  try {
    const { firebaseToken } = req.body;

    if (!firebaseToken) {
      return res.status(400).json({ message: "Token required" });
    }

    const decoded = await admin.auth().verifyIdToken(firebaseToken);

    const phone = decoded.phone_number;

    let user = await User.findOne({ phone });

    if (!user) {
      user = await User.create({
        phone,
        provider: "phone",
        userId: uuidv4()
      });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "365d" }
    );

    res.json({
      success: true,
      token,
      user
    });

  } catch (err) {
    res.status(401).json({ message: "Authentication failed" });
  }
};
