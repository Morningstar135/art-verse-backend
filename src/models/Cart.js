const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema(
  {
    artworkId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artwork",
      required: true,
    },
    medium: {
      type: String,
      required: true,
      enum: ["paper", "canvas"],
    },
    size: {
      type: String,
      required: true,
      enum: ["A4", "A3", "A2"],
    },
    quality: {
      type: String,
      required: true,
      enum: ["200gsm", "300gsm"],
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, "Quantity must be at least 1"],
      max: [10, "Quantity cannot exceed 10"],
      validate: {
        validator: Number.isInteger,
        message: "Quantity must be an integer",
      },
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    items: [cartItemSchema],
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
  }
);

const Cart = mongoose.model("Cart", cartSchema);

module.exports = Cart;
