const jwt = require("jsonwebtoken");

/**
 * Generate an access token.
 * @param {Object} payload - Data to encode in the token (e.g. { id, role }).
 * @returns {string} Signed JWT access token.
 */
const generateAccessToken = (payload) => {
  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES_IN || "15m";

  return jwt.sign(payload, secret, { expiresIn });
};

/**
 * Generate a refresh token.
 * @param {Object} payload - Data to encode in the token (e.g. { id }).
 * @returns {string} Signed JWT refresh token.
 */
const generateRefreshToken = (payload) => {
  const secret = process.env.JWT_REFRESH_SECRET;
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

  return jwt.sign(payload, secret, { expiresIn });
};

/**
 * Verify a token and return the decoded payload.
 * @param {string} token  - The JWT string to verify.
 * @param {string} secret - The secret used to sign the token.
 * @returns {Object} Decoded payload.
 * @throws {JsonWebTokenError|TokenExpiredError} If verification fails.
 */
const verifyToken = (token, secret) => {
  return jwt.verify(token, secret);
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
};
