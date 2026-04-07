const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const adminAuth = require("../middleware/adminAuth");
const { uploadImage, uploadVideo } = require("../middleware/upload");

// Admin controllers
const adminArtworkController = require("../controllers/admin/artworkController");
const adminCategoryController = require("../controllers/admin/categoryController");
const adminCourseController = require("../controllers/admin/courseController");
const adminOrderController = require("../controllers/admin/orderController");
const adminDashboardController = require("../controllers/admin/dashboardController");
const adminAnnouncementController = require("../controllers/admin/announcementController");

// All admin routes require authentication + admin authorization
router.use(auth, adminAuth);

// ── Dashboard ──────────────────────────────────────────────────────────
router.get("/dashboard", adminDashboardController.getStats);

// ── Artworks ───────────────────────────────────────────────────────────
router.get("/artworks", adminArtworkController.listAll);
router.post("/artworks", uploadImage, adminArtworkController.create);
router.put("/artworks/:id", uploadImage, adminArtworkController.update);
router.delete("/artworks/:id", adminArtworkController.remove);

// ── Categories ─────────────────────────────────────────────────────────
router.get("/categories", adminCategoryController.list);
router.post("/categories", adminCategoryController.create);
router.put("/categories/:id", adminCategoryController.update);
router.delete("/categories/:id", adminCategoryController.remove);

// ── Courses ────────────────────────────────────────────────────────────
router.get("/courses", adminCourseController.list);
router.post("/courses", uploadImage, adminCourseController.create);
router.put("/courses/:id", uploadImage, adminCourseController.update);
router.delete("/courses/:id", adminCourseController.remove);

// ── Course Lessons ─────────────────────────────────────────────────────
router.post("/courses/:id/lessons", uploadVideo, adminCourseController.addLesson);
router.put(
  "/courses/:id/lessons/:lessonId",
  uploadVideo,
  adminCourseController.updateLesson
);
router.delete(
  "/courses/:id/lessons/:lessonId",
  adminCourseController.removeLesson
);

// ── Orders ─────────────────────────────────────────────────────────────
router.get("/orders", adminOrderController.listAll);
router.get("/orders/:id", adminOrderController.getDetail);
router.put("/orders/:id/status", adminOrderController.updateStatus);

// ── Announcements ─────────────────────────────────────────────────────
router.get("/announcements", adminAnnouncementController.list);
router.post("/announcements", adminAnnouncementController.create);
router.put("/announcements/:id", adminAnnouncementController.update);
router.delete("/announcements/:id", adminAnnouncementController.remove);

module.exports = router;
