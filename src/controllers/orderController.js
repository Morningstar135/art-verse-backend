const { body, param, query, validationResult } = require("express-validator");
const Order = require("../models/Order");
const Cart = require("../models/Cart");
const Artwork = require("../models/Artwork");
const razorpayService = require("../services/razorpayService");

/**
 * POST /api/orders
 * Creates a new order from the user's cart and initiates Razorpay payment.
 */
const createOrder = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user._id;
    const { shippingAddress } = req.body;

    // Fetch user's cart with populated artwork data
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

    // Create a lookup map for artworks
    const artworkMap = {};
    artworks.forEach((artwork) => {
      artworkMap[artwork._id.toString()] = artwork;
    });

    // Validate all artworks still exist and are active
    for (const item of cart.items) {
      const artwork = artworkMap[item.artworkId.toString()];
      if (!artwork) {
        return res.status(400).json({
          error: `Artwork is no longer available. Please update your cart.`,
        });
      }
    }

    // Snapshot cart items into order items
    const orderItems = cart.items.map((item) => {
      const artwork = artworkMap[item.artworkId.toString()];

      // Find matching pricing from artwork
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

    // Calculate totals
    const subtotal = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const total = subtotal;

    // Create the order document first to get the ID
    const order = new Order({
      userId,
      items: orderItems,
      shippingAddress,
      subtotal,
      total,
      status: "pending",
      paymentStatus: "pending",
    });

    await order.save();

    // Create Razorpay order
    const razorpayOrder = await razorpayService.createOrder(
      total,
      "INR",
      order._id.toString()
    );

    // Update order with Razorpay order ID
    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    // Clear user's cart
    await Cart.findOneAndUpdate({ userId }, { items: [] });

    return res.status(201).json({
      orderId: order._id,
      orderNumber: order.orderNumber,
      razorpayOrderId: razorpayOrder.id,
      amount: total,
      currency: "INR",
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Create order error:", error);
    return res.status(500).json({ error: "Failed to create order" });
  }
};

/**
 * POST /api/orders/:id/verify-payment
 * Verifies Razorpay payment and updates order status.
 */
const verifyPayment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Verify the order belongs to the authenticated user
    if (order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Unauthorized access to order" });
    }

    // Verify payment signature
    const isValid = razorpayService.verifyPayment(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    if (!isValid) {
      return res.status(400).json({ error: "Payment verification failed" });
    }

    // Update order with payment details
    order.paymentId = razorpayPaymentId;
    order.status = "confirmed";
    order.paymentStatus = "paid";
    await order.save();

    return res.status(200).json(order);
  } catch (error) {
    console.error("Verify payment error:", error);
    return res.status(500).json({ error: "Payment verification failed" });
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

    // Verify the order belongs to the authenticated user
    if (order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Unauthorized access to order" });
    }

    return res.status(200).json(order);
  } catch (error) {
    console.error("Get order detail error:", error);
    return res.status(500).json({ error: "Failed to fetch order details" });
  }
};

// Validation rules
const verifyPaymentValidation = [
  body("razorpayPaymentId")
    .notEmpty()
    .withMessage("Razorpay payment ID is required"),
  body("razorpayOrderId")
    .notEmpty()
    .withMessage("Razorpay order ID is required"),
  body("razorpaySignature")
    .notEmpty()
    .withMessage("Razorpay signature is required"),
];

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
  verifyPayment,
  getUserOrders,
  getOrderDetail,
  verifyPaymentValidation,
  createOrderValidation,
};
