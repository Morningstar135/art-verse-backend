const { validationResult, body } = require("express-validator");
const User = require("../models/User");
const {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
} = require("../utils/jwt");
const twilioService = require("../services/twilioService");

/**
 * Validation rules for the register endpoint.
 */
const registerValidation = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),
  body("phone")
    .trim()
    .matches(/^\d{10}$/)
    .withMessage("Phone must be exactly 10 digits"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters"),
];

/**
 * Validation rules for the login endpoint.
 */
const loginValidation = [
  body("phone")
    .trim()
    .matches(/^\d{10}$/)
    .withMessage("Phone must be exactly 10 digits"),
  body("password").notEmpty().withMessage("Password is required"),
];

/**
 * Helper: attach the refresh token as an HTTP-only cookie on the response.
 * @param {object} res - Express response object.
 * @param {string} refreshToken - The signed refresh JWT.
 */
const setRefreshCookie = (res, refreshToken) => {
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

/**
 * POST /api/auth/register
 * Create a new user account and return tokens.
 */
const register = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, phone, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(409).json({ message: "Phone number already in use" });
    }

    // Create user (password is hashed via pre-save hook)
    const user = await User.create({ name, phone, password });

    // Generate tokens — pass a plain object, not the Mongoose document
    const tokenPayload = { id: user._id.toString(), role: user.role };
    const token = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Set refresh token cookie
    setRefreshCookie(res, refreshToken);

    return res.status(201).json({
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
      token,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/login
 * Authenticate a user and return tokens.
 */
const login = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { phone, password } = req.body;

    // Find user by phone (explicitly select password since toJSON strips it)
    const user = await User.findOne({ phone }).select("+password");
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate tokens — pass a plain object, not the Mongoose document
    const tokenPayload = { id: user._id.toString(), role: user.role };
    const token = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Set refresh token cookie
    setRefreshCookie(res, refreshToken);

    return res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
      token,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/refresh
 * Issue a new access token using the refresh token from cookie.
 */
const refresh = async (req, res, next) => {
  try {
    // Read refresh token from body or cookies
    const refreshToken = req.body.refreshToken || (req.cookies && req.cookies.refreshToken);
    if (!refreshToken) {
      return res.status(401).json({ message: "No refresh token provided" });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = verifyToken(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(401).json({ message: "Invalid or expired refresh token" });
    }

    // Find user
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Generate new access token — pass a plain object, not the Mongoose document
    const token = generateAccessToken({ id: user._id.toString(), role: user.role });

    return res.status(200).json({ token });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/me
 * Return the currently authenticated user's profile.
 * Requires auth middleware to populate req.user.
 */
const me = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      id: user._id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      addresses: user.addresses,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/send-otp
 * Send OTP to a phone number for verification.
 */
const sendOtp = async (req, res, next) => {
  try {
    const { phone } = req.body;

    if (!phone || !/^\d{10}$/.test(phone)) {
      return res.status(400).json({ error: "Valid 10-digit phone number is required" });
    }

    const result = await twilioService.sendOTP(`+91${phone}`);

    return res.status(200).json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("Send OTP error:", error);
    return res.status(500).json({ error: "Failed to send OTP" });
  }
};

/**
 * POST /api/auth/verify-otp
 * Verify OTP for a phone number.
 */
const verifyOtp = async (req, res, next) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !/^\d{10}$/.test(phone)) {
      return res.status(400).json({ error: "Valid 10-digit phone number is required" });
    }

    if (!code) {
      return res.status(400).json({ error: "OTP code is required" });
    }

    const result = await twilioService.verifyOTP(`+91${phone}`, code);

    if (!result.valid) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    return res.status(200).json({ verified: true });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return res.status(500).json({ error: "Failed to verify OTP" });
  }
};

/**
 * POST /api/auth/forgot-password
 * Send OTP to phone for password reset.
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { phone } = req.body;

    if (!phone || !/^\d{10}$/.test(phone)) {
      return res.status(400).json({ error: "Valid 10-digit phone number is required" });
    }

    // Check if user exists
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ error: "No account found with this phone number" });
    }

    const result = await twilioService.sendOTP(`+91${phone}`);

    return res.status(200).json({ message: "OTP sent for password reset" });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ error: "Failed to send OTP" });
  }
};

/**
 * POST /api/auth/reset-password
 * Verify OTP and reset password.
 */
const resetPassword = async (req, res, next) => {
  try {
    const { phone, code, newPassword } = req.body;

    if (!phone || !/^\d{10}$/.test(phone)) {
      return res.status(400).json({ error: "Valid 10-digit phone number is required" });
    }

    if (!code) {
      return res.status(400).json({ error: "OTP code is required" });
    }

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    // Verify OTP
    const result = await twilioService.verifyOTP(`+91${phone}`, code);
    if (!result.valid) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    // Update password
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ error: "Failed to reset password" });
  }
};

module.exports = {
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
};
