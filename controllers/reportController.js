const Report      = require("../models/Report");
const User        = require("../models/User");
const UserBan     = require("../models/UserBan");
const UserWarning = require("../models/UserWarning");

// ── Get all reports ───────────────────────────────────────────────────────────
exports.getAllReports = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const reports = await Report.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const enriched = await Promise.all(
      reports.map(async (r) => {
        const reporter = await User.findOne({ userId: r.reportedBy })
          .select("name profilePic userId");
        const reported = await User.findOne({ userId: r.reportedUser })
          .select("name profilePic userId");
        const ban = await UserBan.findOne({ userId: r.reportedUser });
        return {
          ...r.toObject(),
          reporterInfo: reporter,
          reportedInfo: { ...reported?.toObject(), banInfo: ban },
        };
      })
    );

    const total = await Report.countDocuments(filter);

    res.status(200).json({
      success: true,
      reports: enriched,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("getAllReports error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── Get single report ─────────────────────────────────────────────────────────
exports.getReportById = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    const [reporter, reported, ban, warnings] = await Promise.all([
      User.findOne({ userId: report.reportedBy }).select("name profilePic userId email"),
      User.findOne({ userId: report.reportedUser }).select("name profilePic userId email"),
      UserBan.findOne({ userId: report.reportedUser }),
      UserWarning.find({ userId: report.reportedUser }).sort({ createdAt: -1 }),
    ]);

    res.status(200).json({
      success: true,
      report: {
        ...report.toObject(),
        reporterInfo: reporter,
        reportedInfo: { ...reported?.toObject(), banInfo: ban, warnings },
      },
    });
  } catch (error) {
    console.error("getReportById error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── Dismiss report ────────────────────────────────────────────────────────────
exports.dismissReport = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    report.status     = "dismissed";
    report.action     = "dismissed";
    report.adminNote  = req.body.note || "";
    report.reviewedBy = req.user.userId;
    report.reviewedAt = new Date();
    await report.save();

    res.status(200).json({ success: true, message: "Report dismissed" });
  } catch (error) {
    console.error("dismissReport error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── Warn user ─────────────────────────────────────────────────────────────────
exports.warnUser = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    // Save warning in its own table
    await UserWarning.create({
      userId:   report.reportedUser,
      reason:   report.reason,
      reportId: report._id.toString(),
      warnedBy: req.user.userId,
      note:     req.body.note || "",
    });

    report.status     = "reviewed";
    report.action     = "warned";
    report.adminNote  = req.body.note || "";
    report.reviewedBy = req.user.userId;
    report.reviewedAt = new Date();
    await report.save();

    // Count total warnings for this user
    const warningCount = await UserWarning.countDocuments({ userId: report.reportedUser });

    res.status(200).json({
      success: true,
      message: "User warned",
      totalWarnings: warningCount,
    });
  } catch (error) {
    console.error("warnUser error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── Ban user ──────────────────────────────────────────────────────────────────
exports.banUser = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    const { permanent = false, durationDays = 7, note = "" } = req.body;
    const banUntil = permanent ? null : new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

    // Upsert ban record in UserBan table
    await UserBan.findOneAndUpdate(
      { userId: report.reportedUser },
      {
        isBanned:    true,
        isPermanent: permanent,
        banUntil:    banUntil,
        banReason:   report.reason,
        bannedBy:    req.user.userId,
      },
      { upsert: true, new: true }
    );

    report.status     = "reviewed";
    report.action     = permanent ? "banned_permanent" : `banned_${durationDays}d`;
    report.adminNote  = note;
    report.reviewedBy = req.user.userId;
    report.reviewedAt = new Date();
    await report.save();

    res.status(200).json({
      success: true,
      message: permanent
        ? "User permanently banned"
        : `User banned for ${durationDays} days`,
    });
  } catch (error) {
    console.error("banUser error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── Unban user ────────────────────────────────────────────────────────────────
exports.unbanUser = async (req, res) => {
  try {
    const { userId } = req.params;

    await UserBan.findOneAndUpdate(
      { userId },
      { isBanned: false, banUntil: null, isPermanent: false, banReason: "" },
      { new: true }
    );

    res.status(200).json({ success: true, message: "User unbanned successfully" });
  } catch (error) {
    console.error("unbanUser error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── Get user ban + warning history ───────────────────────────────────────────
exports.getUserModerationHistory = async (req, res) => {
  try {
    const { userId } = req.params;

    const [user, ban, warnings] = await Promise.all([
      User.findOne({ userId }).select("name profilePic email userId"),
      UserBan.findOne({ userId }),
      UserWarning.find({ userId }).sort({ createdAt: -1 }),
    ]);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      user,
      ban:      ban || null,
      warnings,
      totalWarnings: warnings.length,
    });
  } catch (error) {
    console.error("getUserModerationHistory error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── Dashboard stats ───────────────────────────────────────────────────────────
exports.getReportStats = async (req, res) => {
  try {
    const [total, pending, reviewed, dismissed, banned, warnings] =
      await Promise.all([
        Report.countDocuments(),
        Report.countDocuments({ status: "pending" }),
        Report.countDocuments({ status: "reviewed" }),
        Report.countDocuments({ status: "dismissed" }),
        UserBan.countDocuments({ isBanned: true }),
        UserWarning.countDocuments(),
      ]);

    const reasonBreakdown = await Report.aggregate([
      { $group: { _id: "$reason", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.status(200).json({
      success: true,
      stats: { total, pending, reviewed, dismissed, banned, warnings, reasonBreakdown },
    });
  } catch (error) {
    console.error("getReportStats error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── Report user (existing, kept here for completeness) ───────────────────────
exports.reportUser = async (req, res) => {
  try {
    const reportedBy = req.user.userId;
    const { reportedUserId, reason, description } = req.body;

    const VALID_REASONS = [
      "spam", "harassment", "inappropriate_content",
      "fake_account", "hate_speech", "violence", "other",
    ];

    if (!reportedUserId || !reason) {
      return res.status(400).json({ success: false, message: "reportedUserId and reason are required" });
    }
    if (!VALID_REASONS.includes(reason)) {
      return res.status(400).json({ success: false, message: `Invalid reason` });
    }
    if (reportedBy === reportedUserId) {
      return res.status(400).json({ success: false, message: "You cannot report yourself" });
    }

    const targetUser = await User.findOne({ userId: reportedUserId });
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    await Report.findOneAndUpdate(
      { reportedBy, reportedUser: reportedUserId },
      { reason, description: description || "", status: "pending" },
      { upsert: true, new: true }
    );

    res.status(200).json({ success: true, message: "User reported successfully" });
  } catch (error) {
    console.error("reportUser error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};