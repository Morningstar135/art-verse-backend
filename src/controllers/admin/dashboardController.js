const Order = require("../../models/Order");
const Artwork = require("../../models/Artwork");
const Course = require("../../models/Course");
const Enrollment = require("../../models/Enrollment");

/**
 * GET /api/admin/dashboard
 * Return dashboard statistics.
 */
const getStats = async (req, res, next) => {
  try {
    const [
      totalOrders,
      revenueResult,
      totalArtworks,
      totalCourses,
      totalEnrollments,
      recentOrders,
    ] = await Promise.all([
      Order.countDocuments(),
      Order.aggregate([
        { $match: { paymentStatus: "paid" } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
      Artwork.countDocuments(),
      Course.countDocuments(),
      Enrollment.countDocuments({ paymentStatus: "paid" }),
      Order.find()
        .populate("userId", "name email")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    const totalRevenue =
      revenueResult.length > 0 ? revenueResult[0].total : 0;

    const formattedRecentOrders = recentOrders.map((order) => ({
      id: order._id,
      orderNumber: order.orderNumber,
      customer: order.userId
        ? { name: order.userId.name, email: order.userId.email }
        : null,
      status: order.status,
      paymentStatus: order.paymentStatus,
      total: order.total,
      createdAt: order.createdAt,
    }));

    return res.status(200).json({
      totalOrders,
      totalRevenue,
      totalArtworks,
      totalCourses,
      totalEnrollments,
      recentOrders: formattedRecentOrders,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getStats };
