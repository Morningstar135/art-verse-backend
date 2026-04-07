const Razorpay = require("razorpay");

/**
 * Configure the Razorpay SDK using environment variables.
 * Required env vars:
 *   - RAZORPAY_KEY_ID
 *   - RAZORPAY_KEY_SECRET
 *
 * The client is created lazily so the server can start without
 * Razorpay keys during local development (payment routes will
 * still fail gracefully if keys are missing).
 */
let _client = null;

function getRazorpay() {
  if (!_client) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error(
        "Razorpay keys are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your .env file."
      );
    }
    _client = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return _client;
}

module.exports = getRazorpay;
