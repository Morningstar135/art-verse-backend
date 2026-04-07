const Category = require("../models/Category");

/**
 * GET /api/categories
 * List all categories sorted by sortOrder.
 */
const listCategories = async (_req, res, next) => {
  try {
    const categories = await Category.find()
      .sort({ sortOrder: 1, name: 1 })
      .lean();

    return res.status(200).json({
      categories: categories.map((c) => ({
        id: c._id,
        name: c.name,
        slug: c.slug,
        description: c.description,
      })),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { listCategories };
