const Order = require("../../models/Order");

/**
 * Valid status transitions: only forward, no skipping.
 */
const VALID_TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

/**
 * GET /api/admin/orders
 * List all orders with status/date filters and pagination.
 */
const listAll = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = {};

    // Status filter
    if (req.query.status) {
      filter.status = req.query.status;
    }

    // Date range filters
    if (req.query.startDate || req.query.endDate) {
      filter.createdAt = {};
      if (req.query.startDate) {
        filter.createdAt.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        filter.createdAt.$lte = new Date(req.query.endDate);
      }
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate("userId", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter),
    ]);

    const formatted = orders.map((order) => ({
      id: order._id,
      orderNumber: order.orderNumber,
      customer: order.userId
        ? { name: order.userId.name, email: order.userId.email }
        : null,
      status: order.status,
      paymentStatus: order.paymentStatus,
      total: order.total,
      itemCount: (order.items || []).length,
      createdAt: order.createdAt,
    }));

    return res.status(200).json({
      orders: formatted,
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
 * GET /api/admin/orders/:id
 * Get full order details.
 */
const getDetail = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("userId", "name email")
      .lean();

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    return res.status(200).json({
      id: order._id,
      orderNumber: order.orderNumber,
      customer: order.userId
        ? { name: order.userId.name, email: order.userId.email }
        : null,
      items: order.items,
      shippingAddress: order.shippingAddress,
      subtotal: order.subtotal,
      total: order.total,
      status: order.status,
      paymentId: order.paymentId,
      razorpayOrderId: order.razorpayOrderId,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/orders/:id/status
 * Update order status with valid state transitions.
 */
const updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const currentStatus = order.status;
    const allowedTransitions = VALID_TRANSITIONS[currentStatus] || [];

    if (!allowedTransitions.includes(status)) {
      return res.status(400).json({
        error: `Invalid status transition from "${currentStatus}" to "${status}". Allowed transitions: ${allowedTransitions.join(", ") || "none"}`,
      });
    }

    order.status = status;
    await order.save();

    return res.status(200).json({
      id: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      message: `Order status updated to "${status}"`,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { listAll, getDetail, updateStatus };
