const express = require("express");
const router = express.Router();
const { listArtworks, getArtwork } = require("../controllers/artworkController");

// GET /api/artworks — List artworks (public)
router.get("/", listArtworks);

// GET /api/artworks/:id — Get artwork detail (public)
router.get("/:id", getArtwork);

module.exports = router;
