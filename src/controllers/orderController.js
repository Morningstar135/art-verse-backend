const { body, param, query, validationResult } = require("express-validator");
const Order = require("../models/Order");
const Cart = require("../models/Cart");
const Artwork = require("../models/Artwork");
const User = require("../models/User");
const { notifyAdminNewOrder } = require("../services/emailService");

/**
 * POST /api/orders
 * Creates a new order from the user's cart.
 * Only called after user has paid and entered transaction last 4 digits.
 */
const createOrder = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user._id;
    const { shippingAddress, transactionLast4 } = req.body;

    if (!transactionLast4 || !/^\d{4}$/.test(transactionLast4)) {
      return res.status(400).json({ error: "Please enter the last 4 digits of your transaction ID" });
    }

    // Fetch user's cart
    const cart = await Cart.findOne({ userId }).lean();

    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    // Fetch all artworks referenced in the cart
    const artworkIds = cart.items.map((item) => item.artworkId);
    const artworks = await Artwork.find({
      _id: { $in: artworkIds },
      isActive: true,
    }).lean();

    const artworkMap = {};
    artworks.forEach((artwork) => {
      artworkMap[artwork._id.toString()] = artwork;
    });

    // Validate all artworks still exist and are active
    for (const item of cart.items) {
      const artwork = artworkMap[item.artworkId.toString()];
      if (!artwork) {
        return res.status(400).json({
          error: "Artwork is no longer available. Please update your cart.",
        });
      }
    }

    // Snapshot cart items into order items
    const orderItems = cart.items.map((item) => {
      const artwork = artworkMap[item.artworkId.toString()];

      const pricing = artwork.pricing.find(
        (p) =>
          p.medium === item.medium &&
          p.size === item.size &&
          p.quality === item.quality
      );

      const unitPrice = pricing ? pricing.price : item.price;
      const lineTotal = unitPrice * item.quantity;

      return {
        artworkId: item.artworkId,
        title: artwork.title,
        imageUrl: artwork.imageUrl,
        medium: item.medium,
        size: item.size,
        quality: item.quality,
        quantity: item.quantity,
        unitPrice,
        lineTotal,
      };
    });

    const subtotal = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const total = subtotal;

    // Create order with transaction details — only confirmed orders hit DB
    const order = new Order({
      userId,
      items: orderItems,
      shippingAddress,
      subtotal,
      total,
      transactionLast4,
      status: "pending",
      paymentStatus: "pending",
    });

    await order.save();

    // Clear user's cart
    await Cart.findOneAndUpdate({ userId }, { items: [] });

    // Notify admin via email
    const user = await User.findById(userId).lean();
    const customerName = user?.name || user?.email || "Unknown";

    await notifyAdminNewOrder({
      orderNumber: order.orderNumber,
      amount: total,
      transactionLast4,
      customerName,
    });

    return res.status(201).json({
      orderId: order._id,
      orderNumber: order.orderNumber,
      amount: total,
      currency: "INR",
    });
  } catch (error) {
    console.error("Create order error:", error);
    return res.status(500).json({ error: "Failed to create order" });
  }
};

/**
 * GET /api/orders
 * Returns paginated list of orders for the authenticated user.
 */
const getUserOrders = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const [orders, totalCount] = await Promise.all([
      Order.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments({ userId }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return res.status(200).json({
      orders,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Get user orders error:", error);
    return res.status(500).json({ error: "Failed to fetch orders" });
  }
};

/**
 * GET /api/orders/:id
 * Returns full order details for the authenticated user.
 */
const getOrderDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id).lean();

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Unauthorized access to order" });
    }

    return res.status(200).json(order);
  } catch (error) {
    console.error("Get order detail error:", error);
    return res.status(500).json({ error: "Failed to fetch order details" });
  }
};

const createOrderValidation = [
  body("shippingAddress.line1")
    .notEmpty()
    .withMessage("Address line 1 is required"),
  body("shippingAddress.city").notEmpty().withMessage("City is required"),
  body("shippingAddress.state").notEmpty().withMessage("State is required"),
  body("shippingAddress.pincode")
    .notEmpty()
    .withMessage("Pincode is required")
    .matches(/^\d{6}$/)
    .withMessage("Pincode must be 6 digits"),
  body("shippingAddress.phone")
    .notEmpty()
    .withMessage("Phone is required")
    .matches(/^\d{10}$/)
    .withMessage("Phone must be 10 digits"),
];

module.exports = {
  createOrder,
  getUserOrders,
  getOrderDetail,
  createOrderValidation,
};
