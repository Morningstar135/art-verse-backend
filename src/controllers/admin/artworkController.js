const crypto = require("crypto");
const sharp = require("sharp");
const Artwork = require("../../models/Artwork");
const { uploadFile, deleteFile } = require("../../utils/storage");
const { addWatermark } = require("../../utils/watermark");

/**
 * Compute a fingerprint hash of an image.
 * Normalizes the image (resize to 64x64, grayscale, raw pixels)
 * so that minor metadata/compression differences are ignored,
 * then returns a SHA-256 hex digest.
 */
async function computeImageHash(buffer) {
  const normalized = await sharp(buffer)
    .resize(64, 64, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer();
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

/**
 * GET /api/admin/artworks
 * List all artworks including inactive ones.
 */
const listAll = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const [artworks, total] = await Promise.all([
      Artwork.find()
        .populate("categories", "name slug")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Artwork.countDocuments(),
    ]);

    const formatted = artworks.map((art) => ({
      id: art._id,
      title: art.title,
      description: art.description,
      imageUrl: art.imageUrl,
      categories: (art.categories || []).map((c) => ({
        id: c._id,
        name: c.name,
        slug: c.slug,
      })),
      pricing: art.pricing || [],
      isActive: art.isActive,
      createdAt: art.createdAt,
    }));

    return res.status(200).json({
      artworks: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/artworks
 * Create artwork with R2 image upload.
 * Expects multipart form data with an "image" field.
 */
const create = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Image file is required" });
    }

    // Compute image fingerprint and check for duplicates
    const imageHash = await computeImageHash(req.file.buffer);
    const existing = await Artwork.findOne({ imageHash }).lean();
    if (existing) {
      return res.status(409).json({
        error: "This image has already been uploaded",
        existingArtwork: {
          id: existing._id,
          title: existing.title,
        },
      });
    }

    // Watermark the image before uploading
    const watermarkedBuffer = await addWatermark(req.file.buffer);
    const { url: imageUrl, key: imagePublicId } = await uploadFile(
      req.file,
      "artworks",
      { processedBuffer: watermarkedBuffer, contentType: "image/jpeg" }
    );

    const { title, description, categories, dimensions, medium, year, pricing } =
      req.body;

    let parsedPricing = pricing;
    if (typeof pricing === "string") {
      try {
        parsedPricing = JSON.parse(pricing);
      } catch {
        return res.status(400).json({ error: "Invalid pricing format" });
      }
    }

    let parsedCategories = categories;
    if (typeof categories === "string") {
      try {
        parsedCategories = JSON.parse(categories);
      } catch {
        parsedCategories = categories.split(",").map((c) => c.trim());
      }
    }

    const artwork = new Artwork({
      title,
      description,
      imageUrl,
      imagePublicId,
      imageHash,
      categories: parsedCategories || [],
      dimensions,
      medium,
      year: year ? parseInt(year, 10) : undefined,
      pricing: parsedPricing || [],
    });

    await artwork.save();

    const populated = await Artwork.findById(artwork._id)
      .populate("categories", "name slug")
      .lean();

    return res.status(201).json({
      id: populated._id,
      title: populated.title,
      description: populated.description,
      imageUrl: populated.imageUrl,
      categories: (populated.categories || []).map((c) => ({
        id: c._id,
        name: c.name,
        slug: c.slug,
      })),
      pricing: populated.pricing,
      isActive: populated.isActive,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/artworks/:id
 * Update artwork. Optional new image upload.
 */
const update = async (req, res, next) => {
  try {
    const artwork = await Artwork.findById(req.params.id);

    if (!artwork) {
      return res.status(404).json({ error: "Artwork not found" });
    }

    const { title, description, categories, dimensions, medium, year, pricing, isActive } =
      req.body;

    if (req.file) {
      // Check if new image is a duplicate of another artwork
      const newHash = await computeImageHash(req.file.buffer);
      const duplicate = await Artwork.findOne({
        imageHash: newHash,
        _id: { $ne: artwork._id },
      }).lean();
      if (duplicate) {
        return res.status(409).json({
          error: "This image has already been uploaded",
          existingArtwork: { id: duplicate._id, title: duplicate.title },
        });
      }

      // Delete old image from R2, watermark the new one, then upload
      await deleteFile(artwork.imagePublicId);
      const watermarkedBuffer = await addWatermark(req.file.buffer);
      const { url, key } = await uploadFile(req.file, "artworks", {
        processedBuffer: watermarkedBuffer,
        contentType: "image/jpeg",
      });
      artwork.imageUrl = url;
      artwork.imagePublicId = key;
      artwork.imageHash = newHash;
    }

    if (title !== undefined) artwork.title = title;
    if (description !== undefined) artwork.description = description;
    if (dimensions !== undefined) artwork.dimensions = dimensions;
    if (medium !== undefined) artwork.medium = medium;
    if (year !== undefined) artwork.year = year ? parseInt(year, 10) : undefined;
    if (isActive !== undefined) artwork.isActive = isActive === "true" || isActive === true;

    if (categories !== undefined) {
      let parsedCategories = categories;
      if (typeof categories === "string") {
        try {
          parsedCategories = JSON.parse(categories);
        } catch {
          parsedCategories = categories.split(",").map((c) => c.trim());
        }
      }
      artwork.categories = parsedCategories || [];
    }

    if (pricing !== undefined) {
      let parsedPricing = pricing;
      if (typeof pricing === "string") {
        try {
          parsedPricing = JSON.parse(pricing);
        } catch {
          return res.status(400).json({ error: "Invalid pricing format" });
        }
      }
      artwork.pricing = parsedPricing;
    }

    await artwork.save();

    const populated = await Artwork.findById(artwork._id)
      .populate("categories", "name slug")
      .lean();

    return res.status(200).json({
      id: populated._id,
      title: populated.title,
      description: populated.description,
      imageUrl: populated.imageUrl,
      categories: (populated.categories || []).map((c) => ({
        id: c._id,
        name: c.name,
        slug: c.slug,
      })),
      pricing: populated.pricing,
      isActive: populated.isActive,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/artworks/:id
 * Delete artwork from R2 and DB.
 */
const remove = async (req, res, next) => {
  try {
    const artwork = await Artwork.findById(req.params.id);

    if (!artwork) {
      return res.status(404).json({ error: "Artwork not found" });
    }

    await deleteFile(artwork.imagePublicId);
    await Artwork.findByIdAndDelete(req.params.id);

    return res.status(200).json({ message: "Artwork deleted successfully" });
  } catch (error) {
    next(error);
  }
};

module.exports = { listAll, create, update, remove };
