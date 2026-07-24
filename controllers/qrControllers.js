const express = require("express");
const router = express.Router();
const QRCode = require("qrcode");
const User = require("../models/User");

exports.generate = async (req, res) => {
  console.log("---- QR GENERATION START ----");

  try {
    const loggedInUser = req.user;

    const user = await User.findOne({
      userId: loggedInUser.userId,
      isDeleted: { $ne: true },
    }).select("-password -lastSeen -createdAt -updatedAt -__v");

    if (!user) {
      console.log("User not found");
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const payloadObj = {
      vconnect: true,
      userCode: user.userId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      bio: user.bio,
      profilePic: user.profilePic,
    };

    const payload = JSON.stringify(payloadObj);

    const qrBase64 = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: "H",
      width: 400,
      margin: 2,
      color: {
        dark: "#075E54",
        light: "#FFFFFF",
      },
    });

    res.json({
      success: true,
      qrImage: qrBase64,
      payload: payloadObj,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ── POST /qr/lookup  → verify scanned QR and return full profile ──────────────
exports.lookup = async (req, res) => {
  try {
    const { userCode } = req.body;

    if (!userCode) {
      return res.status(400).json({
        success: false,
        message: "userCode is required",
      });
    }

    const user = await User.findOne({
      userId: userCode,
      isDeleted: { $ne: true },
    }).select("-password -lastSeen -createdAt -updatedAt -__v");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      user: {
        userCode: user.userId,
        name: user.name,
        email: user.email || "",
        // phone       : user.phone        || '',
        profilePic: user.profilePic || "",
        // designation : user.designation  || '',
        // company     : user.company      || '',
        // bio         : user.bio          || ''
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /qr/match-contacts  → match phone numbers against users ──────────────
// exports.matchcontacts = async (req, res) => {
//     console.log("🔥 matchcontacts API HIT");
//     console.log("👉 Raw body:", JSON.stringify(req.body, null, 2));

//     try {
//         const { phones } = req.body;

//         if (!phones || !Array.isArray(phones)) {
//             console.log("❌ Invalid phones input");
//             return res.status(400).json({
//                 success: false,
//                 message: "phones array required"
//             });
//         }

//         console.log(`📞 Incoming phones count: ${phones.length}`);
//         console.log("📞 Incoming phones sample:", phones.slice(0, 5));

//         // Normalise every phone coming from Android
//         const normalisePhone = (raw) => {
//             let cleaned = raw.replace(/[\s\-().]/g, '');

//             if (cleaned.startsWith('+')) return cleaned;

//             if (/^[6-9]\d{9}$/.test(cleaned)) return '+91' + cleaned;

//             if (cleaned.startsWith('0') && cleaned.length === 11)
//                 return '+91' + cleaned.slice(1);

//             if (cleaned.startsWith('91') && cleaned.length === 12)
//                 return '+' + cleaned;

//             return cleaned;
//         };

//         const cleanPhones = [...new Set(phones.map(normalisePhone))];

//         console.log(`✅ Clean phones count: ${cleanPhones.length}`);
//         console.log("✅ Clean phones sample:", cleanPhones.slice(0, 5));

//         // Build variants
//         const allVariants = [];
//         cleanPhones.forEach(p => {
//             allVariants.push(p);

//             if (p.startsWith('+91') && p.length === 13) {
//                 allVariants.push(p.slice(3));
//                 allVariants.push('0' + p.slice(3));
//             }
//         });

//         console.log(`🔁 Total variants count: ${allVariants.length}`);
//         console.log("🔁 Variants sample:", allVariants);

//         // DB Query
//         console.log("🟡 Querying DB...");
//         const users = await User.find({
//             phone: { $in: allVariants }
//         }).select('phone userId profilePic name');

//         console.log(`🟢 Users matched from DB: ${users.length}`);
//         console.log("🟢 Users sample:", users.slice(0, 3));

//         // Build map
//         const variantMap = {};
//         users.forEach(u => {
//             const normalised = normalisePhone(u.phone || '');
//             variantMap[normalised] = u;
//             variantMap[u.phone] = u;
//         });

//         console.log(`🗺️ Variant map size: ${Object.keys(variantMap).length}`);

//         // Match result
//         const matched = cleanPhones.map(phone => {
//             const user = users.find(u =>
//                 u.phone.includes(phone.slice(-6))
//             );

//             if (!user) {
//                 console.log(`❌ No match for: ${phone}`);
//             } else {
//                 console.log(`✅ Match found: ${phone} → ${user.userId}`);
//             }

//             return {
//                 phone,
//                 userCode: user?.userId || '',
//                 name: user?.name || '',
//                 profilePic: user?.profilePic || '',
//                 isOnApp: !!user
//             };
//         });

//         const onApp = matched.filter(m => m.isOnApp).length;

//         console.log(`📊 Final Result: ${matched.length} total`);
//         console.log(`📊 On App Users: ${onApp}`);
//         console.log(`📊 Not On App: ${matched.length - onApp}`);

//         return res.status(200).json({
//             success: true,
//             data: matched
//         });

//     } catch (error) {
//         console.error('💥 matchcontacts ERROR:', error);
//         console.error('💥 Stack:', error.stack);

//         return res.status(500).json({
//             success: false,
//             message: 'Server error'
//         });
//     }
// };

// exports.matchcontacts = async (req, res) => {
//     try {
//         const { phones } = req.body;

//         if (!phones || !Array.isArray(phones)) {
//             return res.status(400).json({
//                 success: false,
//                 message: "phones array required"
//             });
//         }

//         // Normalise every phone coming from Android
//         const normalisePhone = (raw) => {
//             let cleaned = raw.replace(/[\s\-().]/g, '');

//             // Already has +
//             if (cleaned.startsWith('+')) return cleaned;

//             // 10 digit Indian mobile (starts 6-9)
//             if (/^[6-9]\d{9}$/.test(cleaned)) return '+91' + cleaned;

//             // Leading 0, 11 digits → Indian
//             if (cleaned.startsWith('0') && cleaned.length === 11)
//                 return '+91' + cleaned.slice(1);

//             // 91 prefix without +
//             if (cleaned.startsWith('91') && cleaned.length === 12)
//                 return '+' + cleaned;

//             return cleaned;
//         };

//         const cleanPhones = [...new Set(phones.map(normalisePhone))];
//         console.log("cleanPhones count:", cleanPhones.length);

//         // Build variants: for each +91XXXXXXXXXX also try bare 10 digits
//         // in case some users stored without country code in DB
//         const allVariants = [];
//         cleanPhones.forEach(p => {
//             allVariants.push(p);
//             if (p.startsWith('+91') && p.length === 13) {
//                 allVariants.push(p.slice(3));       // 10 digits
//                 allVariants.push('0' + p.slice(3)); // 011 digits
//             }
//         });

//         const users = await User.find({
//             phone: { $in: allVariants }
//         }).select('phone userId profilePic name');

//         console.log("Matched users:", users.length);

//         // Build a map from every variant → user
//         const variantMap = {};
//         users.forEach(u => {
//             const normalised = normalisePhone(u.phone || '');
//             variantMap[normalised] = u;
//             // Also map raw stored value
//             variantMap[u.phone]    = u;
//         });

//         const matched = cleanPhones.map(phone => {
//             // Try normalised first, then raw
//             const user = variantMap[phone];

//             return {
//                 phone,
//                 userCode  : user?.userId     || '',
//                 name      : user?.name       || '',
//                 profilePic: user?.profilePic || '',
//                 isOnApp   : !!user
//             };
//         });

//         const onApp = matched.filter(m => m.isOnApp).length;
//         console.log(`Result: ${matched.length} total, ${onApp} on app`);

//         return res.status(200).json({
//             success: true,
//             data   : matched
//         });

//     } catch (error) {
//         console.error('matchcontacts error:', error);
//         return res.status(500).json({
//             success: false,
//             message: 'Server error'
//         });
//     }
// };

exports.matchcontacts = async (req, res) => {
  console.log("🔥 matchcontacts API HIT");
  console.log("👉 Raw body:", JSON.stringify(req.body, null, 2));

  try {
    const { phones } = req.body;

    if (!phones || !Array.isArray(phones)) {
      console.log("❌ Invalid phones input");
      return res.status(400).json({
        success: false,
        message: "phones array required",
      });
    }

    console.log(`📞 Incoming phones count: ${phones.length}`);

    // ✅ GLOBAL NORMALIZATION (no country assumption)
    const normalisePhone = (raw) => {
      if (!raw) return "";
      let cleaned = raw.replace(/[\s\-().]/g, "");
      cleaned = cleaned.replace(/[^\d+]/g, "");
      return cleaned;
    };

    const cleanPhones = [...new Set(phones.map(normalisePhone))];

    console.log(`✅ Clean phones count: ${cleanPhones.length}`);
    console.log("✅ Clean phones sample:", cleanPhones.slice(0, 5));

    // ✅ Build variants (global)
    const allVariants = [];

    cleanPhones.forEach((p) => {
      allVariants.push(p);

      const digitsOnly = p.replace(/\D/g, "");

      // add last 10 digits (works globally for matching)
      if (digitsOnly.length >= 10) {
        allVariants.push(digitsOnly.slice(-10));
      }

      // also add full digits (without +)
      allVariants.push(digitsOnly);
    });

    console.log(`🔁 Total variants count: ${allVariants.length}`);
    console.log("🔁 Variants sample:", allVariants.slice(0, 10));

    // ✅ DB Query
    console.log("🟡 Querying DB...");
    const users = await User.find({
      phone: { $in: allVariants },
    }).select("phone userId profilePic name");

    console.log(`🟢 Users matched from DB: ${users.length}`);
    console.log("🟢 Users sample:", users.slice(0, 3));

    // ✅ Smart matching (handles format differences)
    const matched = cleanPhones.map((phone) => {
      const inputDigits = phone.replace(/\D/g, "");

      const user = users.find((u) => {
        const dbDigits = (u.phone || "").replace(/\D/g, "");

        // match by last 10 digits
        return dbDigits.endsWith(inputDigits.slice(-10));
      });

      if (!user) {
        console.log(`❌ No match for: ${phone}`);
      } else {
        console.log(`✅ Match found: ${phone} → ${user.userId}`);
      }

      return {
        phone,
        userCode: user?.userId || "",
        name: user?.name || "",
        profilePic: user?.profilePic || "",
        isOnApp: !!user,
      };
    });

    const onApp = matched.filter((m) => m.isOnApp).length;

    console.log(`📊 Final Result: ${matched.length} total`);
    console.log(`📊 On App Users: ${onApp}`);
    console.log(`📊 Not On App: ${matched.length - onApp}`);

    return res.status(200).json({
      success: true,
      data: matched,
    });
  } catch (error) {
    console.error("💥 matchcontacts ERROR:", error);
    console.error("💥 Stack:", error.stack);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
