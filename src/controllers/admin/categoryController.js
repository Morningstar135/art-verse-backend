const Category = require("../../models/Category");
const Artwork = require("../../models/Artwork");

/**
 * GET /api/admin/categories
 * List all categories.
 */
const list = async (req, res, next) => {
  try {
    const categories = await Category.find()
      .sort({ sortOrder: 1, name: 1 })
      .lean();

    const formatted = categories.map((c) => ({
      id: c._id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      sortOrder: c.sortOrder,
      createdAt: c.createdAt,
    }));

    return res.status(200).json({ categories: formatted });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/categories
 * Create a new category.
 */
const create = async (req, res, next) => {
  try {
    const { name, description, sortOrder } = req.body;

    if (!name || name.trim().length < 2) {
      return res
        .status(400)
        .json({ error: "Category name is required (min 2 characters)" });
    }

    const category = new Category({
      name: name.trim(),
      description: description ? description.trim() : undefined,
      sortOrder: sortOrder !== undefined ? parseInt(sortOrder, 10) : 0,
    });

    await category.save();

    return res.status(201).json({
      id: category._id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      sortOrder: category.sortOrder,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(400)
        .json({ error: "A category with this name already exists" });
    }
    next(error);
  }
};

/**
 * PUT /api/admin/categories/:id
 * Update a category.
 */
const update = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    const { name, description, sortOrder } = req.body;

    if (name !== undefined) {
      if (name.trim().length < 2) {
        return res
          .status(400)
          .json({ error: "Category name must be at least 2 characters" });
      }
      category.name = name.trim();
    }

    if (description !== undefined) category.description = description.trim();
    if (sortOrder !== undefined) category.sortOrder = parseInt(sortOrder, 10);

    await category.save();

    return res.status(200).json({
      id: category._id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      sortOrder: category.sortOrder,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(400)
        .json({ error: "A category with this name already exists" });
    }
    next(error);
  }
};

/**
 * DELETE /api/admin/categories/:id
 * Remove a category. Reject if artworks reference it.
 */
const remove = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    // Check if any artworks reference this category
    const artworkCount = await Artwork.countDocuments({
      categories: category._id,
    });

    if (artworkCount > 0) {
      return res.status(400).json({
        error: `Cannot delete category. ${artworkCount} artwork(s) still reference it. Remove the category from those artworks first.`,
      });
    }

    await Category.findByIdAndDelete(req.params.id);

    return res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    next(error);
  }
};

module.exports = { list, create, update, remove };
