const Announcement = require("../../models/Announcement");

/**
 * GET /api/admin/announcements
 * List all announcements (admin view — includes inactive).
 */
const list = async (req, res, next) => {
  try {
    const announcements = await Announcement.find()
      .sort({ sortOrder: 1, startDate: -1 })
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
      isActive: a.isActive,
      sortOrder: a.sortOrder,
      createdAt: a.createdAt,
    }));

    return res.status(200).json({ announcements: formatted });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/announcements
 * Create a new announcement.
 */
const create = async (req, res, next) => {
  try {
    const { title, description, type, startDate, endDate, ctaText, ctaLink, isActive } = req.body;

    const announcement = new Announcement({
      title,
      description,
      type: type || "general",
      startDate,
      endDate: endDate || undefined,
      ctaText: ctaText || "Learn More",
      ctaLink: ctaLink || "/courses",
      isActive: isActive !== undefined ? isActive : true,
    });

    await announcement.save();

    return res.status(201).json({
      id: announcement._id,
      title: announcement.title,
      description: announcement.description,
      type: announcement.type,
      startDate: announcement.startDate,
      endDate: announcement.endDate,
      ctaText: announcement.ctaText,
      ctaLink: announcement.ctaLink,
      isActive: announcement.isActive,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/announcements/:id
 * Update an announcement.
 */
const update = async (req, res, next) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      return res.status(404).json({ error: "Announcement not found" });
    }

    const { title, description, type, startDate, endDate, ctaText, ctaLink, isActive, sortOrder } =
      req.body;

    if (title !== undefined) announcement.title = title;
    if (description !== undefined) announcement.description = description;
    if (type !== undefined) announcement.type = type;
    if (startDate !== undefined) announcement.startDate = startDate;
    if (endDate !== undefined) announcement.endDate = endDate || null;
    if (ctaText !== undefined) announcement.ctaText = ctaText;
    if (ctaLink !== undefined) announcement.ctaLink = ctaLink;
    if (isActive !== undefined) announcement.isActive = isActive;
    if (sortOrder !== undefined) announcement.sortOrder = sortOrder;

    await announcement.save();

    return res.status(200).json({
      id: announcement._id,
      title: announcement.title,
      description: announcement.description,
      type: announcement.type,
      startDate: announcement.startDate,
      endDate: announcement.endDate,
      ctaText: announcement.ctaText,
      ctaLink: announcement.ctaLink,
      isActive: announcement.isActive,
      sortOrder: announcement.sortOrder,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/announcements/:id
 * Delete an announcement.
 */
const remove = async (req, res, next) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      return res.status(404).json({ error: "Announcement not found" });
    }

    await Announcement.findByIdAndDelete(req.params.id);
    return res.status(200).json({ message: "Announcement deleted successfully" });
  } catch (error) {
    next(error);
  }
};

module.exports = { list, create, update, remove };
