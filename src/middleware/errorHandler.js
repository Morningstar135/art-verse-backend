/**
 * Centralized error-handling middleware for Express.
 *
 * Handles:
 *  - Mongoose ValidationError    -> 400
 *  - Mongoose CastError          -> 400 (invalid ObjectId)
 *  - MongoDB duplicate key (11000) -> 409
 *  - JWT errors                  -> 401
 *  - Everything else             -> 500
 *
 * In development mode the stack trace is included in the response.
 * Response format: { error: "message" }
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";

  // ---- Mongoose ValidationError ----
  if (err.name === "ValidationError") {
    statusCode = 400;
    const messages = Object.values(err.errors).map((e) => e.message);
    message = messages.join(". ");
  }

  // ---- Mongoose CastError (e.g. invalid ObjectId) ----
  if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // ---- MongoDB duplicate key error ----
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {}).join(", ");
    message = `Duplicate value for field: ${field}. Please use a different value.`;
  }

  // ---- JWT errors ----
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token.";
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token has expired.";
  }

  // Build response
  const response = { error: message };

  if (process.env.NODE_ENV === "development") {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
