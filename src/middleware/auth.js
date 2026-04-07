const { verifyToken } = require("../utils/jwt");
const User = require("../models/User");

/**
 * Authentication middleware.
 * Extracts the Bearer token from the Authorization header, verifies it,
 * looks up the user, and attaches req.user (without the password field).
 * Returns 401 if the token is missing or invalid.
 */
const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Access denied. No token provided." });
    }

    const token = authHeader.split(" ")[1];

    const decoded = verifyToken(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({ error: "User not found. Token is invalid." });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
};

/**
 * Optional authentication middleware.
 * Behaves like `auth` but does NOT return 401 when the token is absent.
 * If the token is missing or invalid, req.user is set to null and the
 * request continues normally.
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(" ")[1];

    const decoded = verifyToken(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password");

    req.user = user || null;
    next();
  } catch (error) {
    // Token was present but invalid -- silently continue without a user.
    req.user = null;
    next();
  }
};

module.exports = { auth, optionalAuth };
