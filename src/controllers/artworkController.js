const Artwork = require("../models/Artwork");

/**
 * GET /api/artworks
 * List active artworks, optionally filter by category slug.
 * Supports pagination via ?page=1&limit=20
 */
const listArtworks = async (req, res, next) => {
  try {
    const { category, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter = { isActive: true };

    // If category slug is provided, resolve category ID first
    if (category) {
      const Category = require("../models/Category");
      const cat = await Category.findOne({ slug: category });
      if (cat) {
        filter.categories = cat._id;
      } else {
        // No matching category — return empty
        return res.status(200).json({
          artworks: [],
          pagination: { page: pageNum, limit: limitNum, total: 0, totalPages: 0 },
        });
      }
    }

    const [artworks, total] = await Promise.all([
      Artwork.find(filter)
        .populate("categories", "name slug")
        .sort({ sortOrder: 1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Artwork.countDocuments(filter),
    ]);

    // Compute startingPrice (lowest price in pricing array)
    const formatted = artworks.map((art) => {
      const prices = (art.pricing || []).map((p) => p.price).filter(Boolean);
      const startingPrice = prices.length > 0 ? Math.min(...prices) : 0;
      return {
        id: art._id,
        title: art.title,
        imageUrl: art.imageUrl,
        categories: (art.categories || []).map((c) => ({
          id: c._id,
          name: c.name,
          slug: c.slug,
        })),
        startingPrice,
      };
    });

    return res.status(200).json({
      artworks: formatted,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/artworks/:id
 * Get artwork detail with full pricing.
 */
const getArtwork = async (req, res, next) => {
  try {
    const artwork = await Artwork.findById(req.params.id)
      .populate("categories", "name slug")
      .lean();

    if (!artwork || !artwork.isActive) {
      return res.status(404).json({ error: "Artwork not found" });
    }

    return res.status(200).json({
      id: artwork._id,
      title: artwork.title,
      description: artwork.description,
      imageUrl: artwork.imageUrl,
      categories: (artwork.categories || []).map((c) => ({
        id: c._id,
        name: c.name,
        slug: c.slug,
      })),
      dimensions: artwork.dimensions,
      medium: artwork.medium,
      year: artwork.year,
      pricing: artwork.pricing || [],
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { listArtworks, getArtwork };
