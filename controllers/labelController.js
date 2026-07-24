const Label    = require("../models/Label");
const Favorite = require("../models/Favorite");

exports.getLabels = async (req, res) => {
  try {
    const userId = req.user.userId;
    const labels = await Label.find({ userId }).sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: labels });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.createLabel = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Label name is required" });
    }

    const label = await Label.create({ userId, name: name.trim(), members: [] });

    return res.status(201).json({ success: true, data: label });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "Label name already exists" });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateLabel = async (req, res) => {
  try {
    const userId  = req.user.userId;
    const { labelId } = req.params;
    const { name, members } = req.body;
    console.log("req.body-->",req.body)

    const label = await Label.findOne({ _id: labelId, userId });
    if (!label) {
      return res.status(404).json({ success: false, message: "Label not found" });
    }

    if (name  !== undefined) label.name    = name.trim();
    if (members !== undefined) label.members = members; 

    await label.save();

    return res.status(200).json({ success: true, data: label });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};


exports.deleteLabel = async (req, res) => {
  try {
    const userId  = req.user.userId;
    const { labelId } = req.params;

    const deleted = await Label.findOneAndDelete({ _id: labelId, userId });
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Label not found" });
    }


    return res.status(200).json({ success: true, message: "Label deleted" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getFavorites = async (req, res) => {
  try {
    const userId   = req.user.userId;
    const favorites = await Favorite.find({ userId }).sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: favorites });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};


exports.toggleFavorite = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { chatCode, isGroup } = req.body;

    if (!chatCode) {
      return res.status(400).json({ success: false, message: "chatCode is required" });
    }

    const existing = await Favorite.findOne({ userId, chatCode });

    if (existing) {
      await Favorite.deleteOne({ userId, chatCode });
      return res.status(200).json({ success: true, action: "removed", chatCode });
    } else {
      const fav = await Favorite.create({ userId, chatCode, isGroup: isGroup ?? false });
      return res.status(201).json({ success: true, action: "added", data: fav });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}; 