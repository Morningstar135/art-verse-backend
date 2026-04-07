const Cart = require("../models/Cart");
const Artwork = require("../models/Artwork");

/**
 * Helper: format cart for API response
 */
function formatCart(cart) {
  const items = (cart?.items || []).map((item) => {
    const art = item.artworkId;
    return {
      artworkId: art?._id || item.artworkId,
      title: art?.title || "",
      imageUrl: art?.imageUrl || "",
      medium: item.medium,
      size: item.size,
      quality: item.quality,
      quantity: item.quantity,
      unitPrice: item.price,
      lineTotal: item.price * item.quantity,
    };
  });
  const total = items.reduce((sum, i) => sum + i.lineTotal, 0);
  return { items, total };
}

/**
 * GET /api/cart
 */
const getCart = async (req, res, next) => {
  try {
    let cart = await Cart.findOne({ userId: req.user._id }).populate(
      "items.artworkId",
      "title imageUrl"
    );
    if (!cart) {
      return res.status(200).json({ items: [], total: 0 });
    }
    return res.status(200).json(formatCart(cart));
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/cart/items
 */
const addItem = async (req, res, next) => {
  try {
    const { artworkId, medium, size, quality, quantity = 1 } = req.body;

    // Validate artwork exists and is active
    const artwork = await Artwork.findOne({ _id: artworkId, isActive: true });
    if (!artwork) {
      return res.status(404).json({ error: "Artwork not found or unavailable" });
    }

    // Look up price from artwork pricing array
    const priceEntry = artwork.pricing.find(
      (p) => p.medium === medium && p.size === size && p.quality === quality
    );
    if (!priceEntry) {
      return res.status(400).json({ error: "Invalid pricing configuration" });
    }

    let cart = await Cart.findOne({ userId: req.user._id });
    if (!cart) {
      cart = new Cart({ userId: req.user._id, items: [] });
    }

    // Check if item with same config already exists
    const existing = cart.items.find(
      (i) =>
        i.artworkId.toString() === artworkId &&
        i.medium === medium &&
        i.size === size &&
        i.quality === quality
    );

    if (existing) {
      existing.quantity = Math.min(10, existing.quantity + quantity);
      existing.price = priceEntry.price;
    } else {
      cart.items.push({
        artworkId,
        medium,
        size,
        quality,
        quantity: Math.min(10, Math.max(1, quantity)),
        price: priceEntry.price,
      });
    }

    await cart.save();

    // Re-populate for response
    cart = await Cart.findById(cart._id).populate("items.artworkId", "title imageUrl");
    return res.status(200).json(formatCart(cart));
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/cart/items/:artworkId
 */
const updateItem = async (req, res, next) => {
  try {
    const { artworkId } = req.params;
    const { medium, size, quality, quantity } = req.body;

    const cart = await Cart.findOne({ userId: req.user._id });
    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }

    const item = cart.items.find(
      (i) =>
        i.artworkId.toString() === artworkId &&
        i.medium === medium &&
        i.size === size &&
        i.quality === quality
    );

    if (!item) {
      return res.status(404).json({ error: "Item not found in cart" });
    }

    item.quantity = Math.min(10, Math.max(1, quantity));
    await cart.save();

    const populated = await Cart.findById(cart._id).populate("items.artworkId", "title imageUrl");
    return res.status(200).json(formatCart(populated));
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/cart/items/:artworkId
 */
const removeItem = async (req, res, next) => {
  try {
    const { artworkId } = req.params;
    const { medium, size, quality } = req.query;

    const cart = await Cart.findOne({ userId: req.user._id });
    if (!cart) {
      return res.status(200).json({ items: [], total: 0 });
    }

    cart.items = cart.items.filter(
      (i) =>
        !(
          i.artworkId.toString() === artworkId &&
          i.medium === medium &&
          i.size === size &&
          i.quality === quality
        )
    );

    await cart.save();

    const populated = await Cart.findById(cart._id).populate("items.artworkId", "title imageUrl");
    return res.status(200).json(formatCart(populated));
  } catch (error) {
    next(error);
  }
};

module.exports = { getCart, addItem, updateItem, removeItem };
