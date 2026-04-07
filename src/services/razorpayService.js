const crypto = require("crypto");
const getRazorpay = require("../config/razorpay");

/**
 * Creates a Razorpay order.
 * @param {number} amount - Amount in paise
 * @param {string} currency - Currency code (default "INR")
 * @param {string} receipt - Receipt identifier
 * @returns {Promise<Object>} The created Razorpay order object
 */
async function createOrder(amount, currency = "INR", receipt) {
  const options = {
    amount,
    currency,
    receipt,
  };
  const order = await getRazorpay().orders.create(options);
  return order;
}

/**
 * Verifies a Razorpay payment signature.
 * @param {string} razorpayOrderId - The Razorpay order ID
 * @param {string} razorpayPaymentId - The Razorpay payment ID
 * @param {string} razorpaySignature - The signature to verify
 * @returns {boolean} Whether the signature is valid
 */
function verifyPayment(razorpayOrderId, razorpayPaymentId, razorpaySignature) {
  const body = razorpayOrderId + "|" + razorpayPaymentId;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");
  return expectedSignature === razorpaySignature;
}

module.exports = {
  createOrder,
  verifyPayment,
};
