const express = require("express");
const router = express.Router();
const { listCategories } = require("../controllers/categoryController");

// GET /api/categories — List all categories (public)
router.get("/", listCategories);

module.exports = router;
