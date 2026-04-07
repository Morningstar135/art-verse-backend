const express = require("express");
const router = express.Router();
const { auth, optionalAuth } = require("../middleware/auth");
const courseController = require("../controllers/courseController");

// GET /api/courses - list published courses
router.get("/", courseController.listCourses);

// GET /api/courses/:id - course detail (optionalAuth to check enrollment)
router.get("/:id", optionalAuth, courseController.getCourseDetail);

// POST /api/courses/:id/enroll - enroll in a course (requires auth)
router.post("/:id/enroll", auth, courseController.enrollInCourse);

// POST /api/courses/:id/verify-payment - verify enrollment payment (requires auth)
router.post("/:id/verify-payment", auth, courseController.verifyEnrollmentPayment);

// GET /api/courses/:id/lessons/:lessonId - get lesson (requires auth + enrollment)
router.get("/:id/lessons/:lessonId", auth, courseController.getLesson);

module.exports = router;
