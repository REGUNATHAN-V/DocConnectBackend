const LoginHistory = require("../models/LoginHistory");
const User = require("../models/User");
const paginate = require("../utlis/paginate");
const bcrypt = require("bcryptjs");
const buildPagination = require("../utlis/pagination");

exports.getAllUsers = async (req, res) => {
  try {
    const {
      role,
      search,
      email,
      connected,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = req.query;

    const filter = {};

    if (role) filter.role = Number(role);

    if (search)
      filter.name = { $regex: search, $options: "i" };

    if (email)
      filter.email = { $regex: email, $options: "i" };

    if (connected !== undefined)
      filter.connected = connected === "true";

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const result = await buildPagination({
      model: User,
      filter,
      page,
      limit,
      sort: { createdAt: -1 },
      select: "-password",
    });

    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch registered users",
      error: err.message,
    });
  }
};

exports.getLoginHistory = async (req, res) => {
  try {
    const {
      userId,
      action,
      ipAddress,
      userAgent,
      startDate,
      endDate,
      page = 1,
      limit = 10,
      sort = "timestamp",
    } = req.query;

    const filter = {};

    if (userId) filter.userId = userId;
    if (action) filter.action = action;

    if (ipAddress)
      filter.ipAddress = { $regex: ipAddress, $options: "i" };

    if (userAgent)
      filter.userAgent = { $regex: userAgent, $options: "i" };

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const result = await buildPagination({
      model: LoginHistory,
      filter,
      page,
      limit,
      sort: { [sort]: -1 },
    });

    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch history",
      error: err.message,
    });
  }
};

// exports.getAllUsers = async (req, res) => {
//   try {
//     const {
//       role,
//       search,
//       email,
//       connected,
//       startDate,
//       endDate,
//       page = 1,
//       limit = 10,
//     } = req.query;

//     const filter = {};

//     if (role) filter.role = Number(role);

//     if (search)
//       filter.name = { $regex: search, $options: "i" };

//     if (email)
//       filter.email = { $regex: email, $options: "i" };

//     if (connected !== undefined)
//       filter.connected = connected === "true";

//     if (startDate || endDate) {
//       filter.createdAt = {};
//       if (startDate) filter.createdAt.$gte = new Date(startDate);
//       if (endDate) filter.createdAt.$lte = new Date(endDate);
//     }

//     const result = await paginate({
//       model: User,
//       filter,
//       page,
//       limit,
//       sort: { createdAt: -1 },
//       select: "-password",
//     });

//     return res.status(200).json({
//       success: true,
//       ...result
//     });

//   } catch (err) {
//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch registered users",
//       error: err.message,
//     });
//   }
// };


// exports.getLoginHistory = async (req, res) => {
//   try {
//     const {
//       userId,
//       action,
//       ipAddress,
//       userAgent,
//       startDate,
//       endDate,
//       page = 1,
//       limit = 10,
//       sort = "timestamp",
//     } = req.query;

//     const filter = {};

//     if (userId) filter.userId = userId;
//     if (action) filter.action = action;

//     if (ipAddress)
//       filter.ipAddress = { $regex: ipAddress, $options: "i" };

//     if (userAgent)
//       filter.userAgent = { $regex: userAgent, $options: "i" };

//     if (startDate || endDate) {
//       filter.timestamp = {};
//       if (startDate) filter.timestamp.$gte = new Date(startDate);
//       if (endDate) filter.timestamp.$lte = new Date(endDate);
//     }

//     const result = await paginate({
//       model: LoginHistory,
//       filter,
//       page,
//       limit,
//       sort: { [sort]: -1 },
//     });

//     return res.status(200).json({
//       success: true,
//       ...result
//     });

//   } catch (err) {
//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch history",
//       error: err.message,
//     });
//   }
// };

exports.editUserProfile = async (req, res) => {
  const { userId } = req.params; 
  const loggedInUser = req.user;

  const { fullName, password, role } = req.body;
  try {
    if (loggedInUser.userId !== userId && loggedInUser.role !== 3) {
      return res.status(403).json({
        message: "You are not authorized to edit this profile",
      });
    }

    const updateData = {};

    if (fullName) updateData.fullName = fullName;

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateData.password = hashedPassword;
    }

    if (role !== undefined) {
      if (loggedInUser.role !== 3) {
        return res.status(403).json({
          message: "Only admin can change role",
        });
      }
      updateData.role = role;
    }

    const updatedUser = await User.findOneAndUpdate(
      { userId },
      { $set: updateData },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "User info updated successfully",
      updatedUser,
    });

  } catch (err) {
    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};