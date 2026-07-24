const User = require("../models/User");
const buildPagination = require("../utlis/pagination");
const Group = require("../models/Group");



exports.getMyProfile = async (req, res) => {
  try {
    const loggedInUser = req.user;


    if (!loggedInUser || !loggedInUser.userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    // Fetch full user data
    const user = await User.findOne({
      userId: loggedInUser.userId,
      isDeleted: { $ne: true }
    }).select("-password -lastSeen -createdAt -updatedAt -__v"); 

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: user
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
      error: err.message
    });
  }
};

exports.getOtherProfile = async (req, res) => {
  try {
    const { userId } = req.query;

    const user = await User.findOne({ userId })
      .select("userId name email phone countryCode profilePic bio dob role");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error("getOtherProfile error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


exports.searchUserForChat = async (req, res) => {
  console.log("Logging--->")
  try {
    const { query, page, limit } = req.query;

    console.log("req.query-->",req.query)

    const filter = {
      isDeleted: { $ne: true }
    };

    const escapeRegex = (text) => {
      return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    };

    const safeQuery = escapeRegex(query);
    const cleanQuery = query.replace(/\D/g, "");

    if (query) {
      filter.$or = [
        { name: { $regex: safeQuery, $options: "i" } },
        { email: { $regex: safeQuery, $options: "i" } },
        { userId: { $regex: safeQuery, $options: "i" } },
        { phone: cleanQuery },
        // { phone: { $regex: cleanQuery } } // partial match by number 

      ];
    }

    const result = await buildPagination({
      model: User,
      filter,
      page,
      limit,
      sort: { createdAt: -1 },
      select: "userId email name phone lastSeen profilePic bio"
    });

    const formattedData = result.data.map(user => ({
      code: user.userId,
      email_id: user.email,
      name: user.name,
      phone: user.phone,
      lastTime: user.lastSeen,
      profilePic: user.profilePic,
      bio: user.bio
    }));

    return res.status(200).json({
      success: true,
      data: formattedData,
      pagination: result.pagination
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
      error: error.message
    });
  }
};

exports.searchUserByMobileNumber = async (req, res) => {
  try {
    console.log("👉 Incoming Query:", req.query);

    let { countryCode, phone, query } = req.query;

    // ✅ Support fallback (if frontend sends array)
    if (query && Array.isArray(query)) {
      countryCode = query[0];
      phone = query[1];
    }

    // ✅ Strict validation
    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone is required"
      });
    }

    // Default country code
    countryCode = countryCode || "+91";

    const cleanPhone = phone.replace(/\D/g, "");
    const cleanCountryCode = countryCode.replace(/\D/g, "");

    // ✅ Final normalized values
    const normalizedPhone = cleanPhone;
    const normalizedCountryCode = `+${cleanCountryCode}`;

    console.log("🧹 Normalized:", {
      normalizedPhone,
      normalizedCountryCode
    });

    // ✅ STRICT EXACT MATCH ONLY
    const filter = {
      isDeleted: { $ne: true },
      phone: normalizedPhone,
      countryCode: normalizedCountryCode
    };

    console.log("🔍 Final Filter:", filter);

    const user = await User.findOne(filter) // ✅ findOne (not find)
      .select("userId email name phone countryCode lastSeen profilePic bio")
      .lean();

    if (!user) {
      console.log("❌ No user found");

      return res.status(404).json({
        success: false,
        message: "User not found",
        data: null
      });
    }

    console.log("✅ User Found:", user.userId);

    const formattedData = {
      code: user.userId,
      email_id: user.email,
      name: user.name,
      phone: user.phone,
      countryCode: user.countryCode,
      lastTime: user.lastSeen ? new Date(user.lastSeen).getTime() : null,
      profilePic: user.profilePic,
      bio: user.bio
    };

    return res.status(200).json({
      success: true,
      data: formattedData
    });

  } catch (error) {
    console.error("❌ ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};
// exports.searchUserForChat = async (req, res) => {
//   try {
//     const { query, page, limit } = req.query;

//     const filter = {
//       isDeleted: { $ne: true }
//     };

//     if (query) {
//       filter.$or = [
//         { name: { $regex: query, $options: "i" } },
//         { email: { $regex: query, $options: "i" } },
//         { userId: { $regex: query, $options: "i" } }
//       ];
//     }

//     const result = await buildPagination({
//       model: User,
//       filter,
//       page,
//       limit,
//       sort: { createdAt: -1 },
//       select: "-password"
//     });

//     return res.status(200).json({
//       success: true,
//       data: result.data,
//       pagination: result.pagination
//     });

//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: "Something went wrong",
//       error: error.message
//     });
//   }
// };

exports.searchUser = async (req, res) => {
  try {
    console.log("👉 Incoming Query:", req.query);

    let { identifier, countryCode = "+91" } = req.query;

    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: "Identifier is required"
      });
    }

    // Normalize
    const cleanPhone = identifier.replace(/\D/g, "");
    const cleanCountryCode = countryCode.replace(/\D/g, "");
    const normalizedCountryCode = `+${cleanCountryCode}`;

    console.log("🧹 Normalized:", {
      cleanPhone,
      normalizedCountryCode,
      identifier
    });

    // 🔥 OR condition (phone OR name)
    const filter = {
      isDeleted: { $ne: true },
      $or: [
        // ✅ Phone match (only if numeric)
        ...(cleanPhone
          ? [{
              phone: cleanPhone,
              countryCode: normalizedCountryCode
            }]
          : []),

        // ✅ Name match
        {
          name: { $regex: identifier, $options: "i" }
        }
      ]

    };

    console.log("🔍 Initial Filter:", filter);

    console.log("🔍 Final Filter:", JSON.stringify(filter, null, 2));

    const users = await User.find(filter)
      .select("userId email name phone countryCode lastSeen profilePic bio")
      .lean();

    if (!users.length) {
      return res.status(404).json({
        success: false,
        message: "No users found",
        data: []
      });
    }

    const formattedData = users.map(user => ({
      code: user.userId,
      email_id: user.email,
      name: user.name,
      phone: user.phone,
      countryCode: user.countryCode,
      lastTime: user.lastSeen ? new Date(user.lastSeen).getTime() : null,
      profilePic: user.profilePic,
      bio: user.bio
    }));

    return res.status(200).json({
      success: true,
      data: formattedData
    });

  } catch (error) {
    console.error("❌ ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};



exports.getCommonGroups = async (req, res) => {
  try {
    const myUserId    = req.user.userId;
    const { userId }  = req.params;

    if (!userId) {
      return res.status(400).json({ success: false, message: "userId is required" });
    }

    // Find groups where BOTH users are members
    const commonGroups = await Group.find({
      members: { $all: [myUserId, userId] }
    });

    const groups = commonGroups.map(g => ({
      groupId   : g.groupId,
      name      : g.name,
      profilePic: g.profilePic || "",
      memberCount: g.members.length,
    }));

    res.status(200).json({
      success: true,
      total  : groups.length,
      groups,
    });
  } catch (error) {
    console.error("getCommonGroups error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};