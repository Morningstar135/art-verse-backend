const express = require("express");
const router = express.Router();
const Announcement = require("../models/Announcement");

/**
 * GET /api/announcements
 * Public endpoint — returns active announcements only.
 */
router.get("/", async (req, res, next) => {
  try {
    const now = new Date();

    // Show active announcements that haven't expired yet.
    // startDate is the event date (displayed to users), NOT when the announcement becomes visible.
    const announcements = await Announcement.find({
      isActive: true,
      $or: [{ endDate: null }, { endDate: { $gte: now } }],
    })
      .sort({ sortOrder: 1, startDate: -1 })
      .limit(5)
      .lean();

    const formatted = announcements.map((a) => ({
      id: a._id,
      title: a.title,
      description: a.description,
      type: a.type,
      startDate: a.startDate,
      endDate: a.endDate,
      ctaText: a.ctaText,
      ctaLink: a.ctaLink,
    }));

    return res.status(200).json({ announcements: formatted });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
