const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const {
  registerValidation,
  loginValidation,
  register,
  login,
  refresh,
  me,
  sendOtp,
  verifyOtp,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");

// POST /api/auth/register - Create a new user account
router.post("/register", registerValidation, register);

// POST /api/auth/login - Authenticate and receive tokens
router.post("/login", loginValidation, login);

// POST /api/auth/refresh - Get a new access token via refresh cookie
router.post("/refresh", refresh);

// GET /api/auth/me - Get current user profile (protected)
router.get("/me", auth, me);

// OTP endpoints
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

module.exports = router;
