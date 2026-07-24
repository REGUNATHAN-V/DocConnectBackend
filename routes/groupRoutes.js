const express = require("express");
const router = express.Router();
const Group = require("../models/Group");

// Create new group
// router.post("/create", async (req, res) => {
//   const { name, members, admin } = req.body;
//   console.log("req.body->",req.body)
//   const groupId = "GRP" + Date.now();
//   const group = new Group({ groupId, name, members, admin });
//   await group.save();
//   res.json({ success: true, group });

//   console.log("res.json-<",res.json)
// });

router.post("/create", async (req, res) => {
  try {
    const { name, members, admin } = req.body;

    // --- Validation ---
    if (!name || !members || !admin) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields (name, members, admin)",
      });
    }

    if (!Array.isArray(members) || members.length < 2) {
      return res.status(400).json({
        success: false,
        message: "A group must have at least 2 members",
      });
    }

    // --- Create group ---
    const groupId = "GRP" + Date.now();
    const group = new Group({ groupId, name, members, admin });
    await group.save();

    console.log(`✅ [GROUP CREATED] ${name} (${groupId}) by ${admin}`);

    res.status(201).json({
      success: true,
      message: "Group created successfully",
      group,
    });
    
  } catch (error) {
    console.error("❌ [GROUP CREATION ERROR]", error.message);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});


// Get user’s groups
router.get("/:code", async (req, res) => {
  const code = req.params.code;
  const groups = await Group.find({
    $or: [
      { members: code },
      { admin: code }
    ]
  });
//   const groups = await Group.find({ members: code});
  res.json(groups);
});

module.exports = router;
