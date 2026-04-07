const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const {
  getCart,
  addItem,
  updateItem,
  removeItem,
} = require("../controllers/cartController");

router.use(auth); // All cart routes require authentication

router.get("/", getCart);
router.post("/items", addItem);
router.put("/items/:artworkId", updateItem);
router.delete("/items/:artworkId", removeItem);

module.exports = router;
