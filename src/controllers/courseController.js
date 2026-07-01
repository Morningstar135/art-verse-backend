const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const User = require("../models/User");
const { notifyAdminNewEnrollment } = require("../services/emailService");

/**
 * GET /api/courses
 * List all published courses with lesson count.
 */
const listCourses = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const skip = (page - 1) * limit;

    const filter = { isPublished: true };

    const [courses, total] = await Promise.all([
      Course.find(filter)
        .select("title description thumbnailUrl price lessons")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Course.countDocuments(filter),
    ]);

    const formatted = courses.map((course) => ({
      id: course._id,
      title: course.title,
      description: course.description,
      thumbnailUrl: course.thumbnailUrl,
      price: course.price,
      lessonCount: (course.lessons || []).length,
    }));

    return res.status(200).json({
      courses: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/courses/:id
 * Get course detail with lessons.
 * If user is authenticated (optionalAuth), check enrollment status.
 * Hide videoUrl for non-enrolled users.
 */
const getCourseDetail = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id).lean();

    if (!course || !course.isPublished) {
      return res.status(404).json({ error: "Course not found" });
    }

    let isEnrolled = false;

    if (req.user) {
      const enrollment = await Enrollment.findOne({
        userId: req.user._id,
        courseId: course._id,
        paymentStatus: "paid",
      });
      isEnrolled = !!enrollment;
    }

    // Hide videoUrl for non-enrolled users
    const lessons = (course.lessons || [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((lesson) => ({
        _id: lesson._id,
        title: lesson.title,
        description: lesson.description,
        videoUrl: isEnrolled ? lesson.videoUrl : null,
        duration: lesson.duration,
        sortOrder: lesson.sortOrder,
      }));

    return res.status(200).json({
      id: course._id,
      title: course.title,
      description: course.description,
      thumbnailUrl: course.thumbnailUrl,
      price: course.price,
      curriculum: course.curriculum,
      lessons,
      isEnrolled,
      lessonCount: lessons.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/courses/:id/enroll
 * Requires auth. Create pending enrollment for manual payment.
 */
const enrollInCourse = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course || !course.isPublished) {
      return res.status(404).json({ error: "Course not found" });
    }

    // Check if already enrolled
    const existingEnrollment = await Enrollment.findOne({
      userId: req.user._id,
      courseId: course._id,
    });

    if (existingEnrollment) {
      if (existingEnrollment.paymentStatus === "paid") {
        return res
          .status(400)
          .json({ error: "You are already enrolled in this course" });
      }
      // If there's a pending/failed enrollment, remove it so we can create a new one
      await Enrollment.deleteOne({ _id: existingEnrollment._id });
    }

    // Create pending enrollment
    const enrollment = new Enrollment({
      userId: req.user._id,
      courseId: course._id,
      paymentStatus: "pending",
    });

    await enrollment.save();

    return res.status(200).json({
      enrollmentId: enrollment._id,
      amount: course.price,
      courseTitle: course.title,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/courses/:id/lessons/:lessonId
 * Requires auth. Verify enrollment. Return lesson with videoUrl.
 */
const getLesson = async (req, res, next) => {
  try {
    const { id, lessonId } = req.params;

    // Verify enrollment
    const enrollment = await Enrollment.findOne({
      userId: req.user._id,
      courseId: id,
      paymentStatus: "paid",
    });

    if (!enrollment) {
      return res
        .status(403)
        .json({ error: "You are not enrolled in this course" });
    }

    const course = await Course.findById(id).lean();

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    const lesson = course.lessons.find(
      (l) => l._id.toString() === lessonId
    );

    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    // Get all lessons sorted for prev/next navigation
    const sortedLessons = (course.lessons || [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((l) => ({ _id: l._id, title: l.title, sortOrder: l.sortOrder }));

    return res.status(200).json({
      lesson: {
        _id: lesson._id,
        title: lesson.title,
        description: lesson.description,
        videoUrl: lesson.videoUrl,
        duration: lesson.duration,
        sortOrder: lesson.sortOrder,
      },
      allLessons: sortedLessons,
      courseTitle: course.title,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/courses/:id/confirm-payment
 * User submits last 4 digits of transaction ID after course payment.
 * Sends SMS notification to admin.
 */
const confirmCoursePayment = async (req, res, next) => {
  try {
    const { transactionLast4 } = req.body;

    if (!transactionLast4 || !/^\d{4}$/.test(transactionLast4)) {
      return res.status(400).json({ error: "Please enter the last 4 digits of your transaction ID" });
    }

    const enrollment = await Enrollment.findOne({
      userId: req.user._id,
      courseId: req.params.id,
    });

    if (!enrollment) {
      return res.status(404).json({ error: "Enrollment not found" });
    }

    enrollment.transactionLast4 = transactionLast4;
    await enrollment.save();

    // Get course and customer details for SMS
    const [course, user] = await Promise.all([
      Course.findById(req.params.id).lean(),
      User.findById(req.user._id).lean(),
    ]);

    const customerName = user?.name || user?.phone || "Unknown";

    await notifyAdminNewEnrollment({
      courseTitle: course?.title || "Unknown Course",
      amount: course?.price || 0,
      transactionLast4,
      customerName,
    });

    return res.status(200).json({ message: "Payment details submitted successfully" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listCourses,
  getCourseDetail,
  enrollInCourse,
  confirmCoursePayment,
  getLesson,
};
