const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [200, "Title must not exceed 200 characters"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      maxlength: [1000, "Description must not exceed 1000 characters"],
    },
    type: {
      type: String,
      required: true,
      enum: {
        values: ["course", "campaign", "event", "general"],
        message: "Type must be course, campaign, event, or general",
      },
      default: "general",
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
    },
    ctaText: {
      type: String,
      trim: true,
      default: "Learn More",
      maxlength: [50, "CTA text must not exceed 50 characters"],
    },
    ctaLink: {
      type: String,
      trim: true,
      default: "/courses",
    },
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

// Index for efficient public queries
announcementSchema.index({ isActive: 1, startDate: 1 });

const Announcement = mongoose.model("Announcement", announcementSchema);

module.exports = Announcement;
