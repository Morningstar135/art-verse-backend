/**
 * Admin authorization middleware.
 * Must be used AFTER the auth middleware so that req.user is populated.
 * Returns 403 Forbidden if the authenticated user does not have the "admin" role.
 */
const adminAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required." });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Access denied. Admin privileges required." });
  }

  next();
};

module.exports = adminAuth;
