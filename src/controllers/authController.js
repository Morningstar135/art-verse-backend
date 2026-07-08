const { validationResult, body } = require("express-validator");
const User = require("../models/User");
const {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
} = require("../utils/jwt");
const emailService = require("../services/emailService");

/**
 * Validation rules for the register endpoint.
 */
const registerValidation = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),
  body("email")
    .trim()
    .isEmail()
    .withMessage("Valid email is required"),
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
  body("email")
    .trim()
    .isEmail()
    .withMessage("Valid email is required"),
  body("password").notEmpty().withMessage("Password is required"),
];

/**
 * Helper: attach the refresh token as an HTTP-only cookie on the response.
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
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, phone, password, otpCode } = req.body;

    // Verify OTP before creating account
    if (!otpCode) {
      return res.status(400).json({ message: "OTP code is required" });
    }

    const otpResult = await emailService.verifyOTP(email, otpCode);
    if (!otpResult.valid) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      const field = existingUser.email === email ? "Email" : "Phone number";
      return res.status(409).json({ message: `${field} already in use` });
    }

    // Create user
    const user = await User.create({ name, email, phone, password });

    const tokenPayload = { id: user._id.toString(), role: user.role };
    const token = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    setRefreshCookie(res, refreshToken);

    return res.status(201).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
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
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const tokenPayload = { id: user._id.toString(), role: user.role };
    const token = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    setRefreshCookie(res, refreshToken);

    return res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
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
 */
const refresh = async (req, res, next) => {
  try {
    const refreshToken = req.body.refreshToken || (req.cookies && req.cookies.refreshToken);
    if (!refreshToken) {
      return res.status(401).json({ message: "No refresh token provided" });
    }

    let decoded;
    try {
      decoded = verifyToken(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(401).json({ message: "Invalid or expired refresh token" });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    const token = generateAccessToken({ id: user._id.toString(), role: user.role });

    return res.status(200).json({ token });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/me
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
 * Send OTP to an email address.
 */
const sendOtp = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Valid email is required" });
    }

    await emailService.sendOTP(email);

    return res.status(200).json({ message: "OTP sent to your email" });
  } catch (error) {
    console.error("Send OTP error:", error.message, error.stack);
    const message = error.message?.includes("SMTP is not configured")
      ? "Email service is not configured on the server"
      : "Failed to send OTP. Please try again later.";
    return res.status(500).json({ error: message });
  }
};

/**
 * POST /api/auth/verify-otp
 * Verify OTP for an email.
 */
const verifyOtp = async (req, res, next) => {
  try {
    const { email, code } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Valid email is required" });
    }

    if (!code) {
      return res.status(400).json({ error: "OTP code is required" });
    }

    const result = await emailService.verifyOTP(email, code, false);

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
 * Send OTP to email for password reset.
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Valid email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "No account found with this email" });
    }

    await emailService.sendOTP(email);

    return res.status(200).json({ message: "OTP sent to your email" });
  } catch (error) {
    console.error("Forgot password error:", error.message, error.stack);
    const message = error.message?.includes("SMTP is not configured")
      ? "Email service is not configured on the server"
      : "Failed to send OTP. Please try again later.";
    return res.status(500).json({ error: message });
  }
};

/**
 * POST /api/auth/reset-password
 * Verify OTP and reset password.
 */
const resetPassword = async (req, res, next) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Valid email is required" });
    }

    if (!code) {
      return res.status(400).json({ error: "OTP code is required" });
    }

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const result = await emailService.verifyOTP(email, code);
    if (!result.valid) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    const user = await User.findOne({ email });
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
