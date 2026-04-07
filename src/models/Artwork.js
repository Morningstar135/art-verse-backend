const mongoose = require("mongoose");

/**
 * Pricing sub-document: one entry per (medium × size × quality) combination.
 * Up to 12 entries per artwork (2 mediums × 3 sizes × 2 qualities).
 * Price is stored in paise (INR × 100).
 */
const pricingSchema = new mongoose.Schema(
  {
    medium: {
      type: String,
      required: true,
      enum: {
        values: ["paper", "canvas"],
        message: "Medium must be paper or canvas",
      },
    },
    size: {
      type: String,
      required: true,
      enum: {
        values: ["A4", "A3", "A2"],
        message: "Size must be A4, A3, or A2",
      },
    },
    quality: {
      type: String,
      required: true,
      enum: {
        values: ["200gsm", "300gsm"],
        message: "Quality must be 200gsm or 300gsm",
      },
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price must be positive"],
    },
  },
  { _id: false }
);

const artworkSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      minlength: [2, "Title must be at least 2 characters"],
      maxlength: [200, "Title must not exceed 200 characters"],
    },
    description: {
      type: String,
      trim: true,
    },
    imageUrl: {
      type: String,
      required: [true, "Image URL is required"],
    },
    imagePublicId: {
      type: String,
      required: [true, "Image public ID is required"],
    },
    imageHash: {
      type: String,
      unique: true,
      sparse: true,
    },
    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    dimensions: {
      type: String,
      trim: true,
    },
    medium: {
      type: String,
      trim: true,
    },
    year: {
      type: Number,
    },
    pricing: [pricingSchema],
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
artworkSchema.index({ categories: 1 });
artworkSchema.index({ isActive: 1, sortOrder: 1 });

const Artwork = mongoose.model("Artwork", artworkSchema);

module.exports = Artwork;
