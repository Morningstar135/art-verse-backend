const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const orderController = require("../controllers/orderController");

// POST /api/orders - Create a new order from cart
router.post(
  "/",
  auth,
  orderController.createOrderValidation,
  orderController.createOrder
);

// POST /api/orders/:id/verify-payment - Verify Razorpay payment
router.post(
  "/:id/verify-payment",
  auth,
  orderController.verifyPaymentValidation,
  orderController.verifyPayment
);

// GET /api/orders - Get user's orders (paginated)
router.get("/", auth, orderController.getUserOrders);

// GET /api/orders/:id - Get order detail
router.get("/:id", auth, orderController.getOrderDetail);

module.exports = router;
