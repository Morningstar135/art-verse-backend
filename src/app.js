require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");

// --- Middleware imports ---
const errorHandler = require("./middleware/errorHandler");

// --- Route imports ---
const authRoutes = require("./routes/auth");
const artworkRoutes = require("./routes/artworks");
const categoryRoutes = require("./routes/categories");
const cartRoutes = require("./routes/cart");
const orderRoutes = require("./routes/orders");
const courseRoutes = require("./routes/courses");
const adminRoutes = require("./routes/admin");
const announcementRoutes = require("./routes/announcements");

// Create Express app
const app = express();

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------

// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: "*",
    credentials: false,
  })
);

// Body parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Simple cookie parser middleware (avoids adding cookie-parser dependency).
app.use((req, _res, next) => {
  req.cookies = {};
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    cookieHeader.split(";").forEach((cookie) => {
      const parts = cookie.split("=");
      const key = parts.shift().trim();
      const value = parts.join("=").trim();
      if (key) {
        req.cookies[key] = decodeURIComponent(value);
      }
    });
  }
  next();
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.use("/api/auth", authRoutes);
app.use("/api/artworks", artworkRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/admin", adminRoutes);

// ---------------------------------------------------------------------------
// Error handler (must be registered LAST)
// ---------------------------------------------------------------------------

app.use(errorHandler);

module.exports = app;
