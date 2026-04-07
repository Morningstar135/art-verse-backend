const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const razorpayService = require("../services/razorpayService");

/**
 * GET /api/courses
 * List all published courses with lesson count.
 */
const listCourses = async (req, res, next) => {
  try {
    const courses = await Course.find({ isPublished: true })
      .select("title description thumbnailUrl price lessons")
      .sort({ createdAt: -1 })
      .lean();

    const formatted = courses.map((course) => ({
      id: course._id,
      title: course.title,
      description: course.description,
      thumbnailUrl: course.thumbnailUrl,
      price: course.price,
      lessonCount: (course.lessons || []).length,
    }));

    return res.status(200).json({ courses: formatted });
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
 * Requires auth. Create Razorpay order and pending enrollment.
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

    // Create Razorpay order
    const receipt = `enroll_${req.user._id}_${course._id}`;
    const razorpayOrder = await razorpayService.createOrder(
      course.price,
      "INR",
      receipt
    );

    // Save pending enrollment
    const enrollment = new Enrollment({
      userId: req.user._id,
      courseId: course._id,
      razorpayOrderId: razorpayOrder.id,
      paymentStatus: "pending",
    });

    await enrollment.save();

    return res.status(200).json({
      razorpayOrderId: razorpayOrder.id,
      amount: course.price,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/courses/:id/verify-payment
 * Requires auth. Verify Razorpay signature, update enrollment to paid.
 */
const verifyEnrollmentPayment = async (req, res, next) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ error: "Missing payment details" });
    }

    // Verify Razorpay signature
    const isValid = razorpayService.verifyPayment(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    if (!isValid) {
      // Mark enrollment as failed
      await Enrollment.findOneAndUpdate(
        {
          userId: req.user._id,
          courseId: req.params.id,
          razorpayOrderId,
        },
        { paymentStatus: "failed" }
      );
      return res.status(400).json({ error: "Payment verification failed" });
    }

    // Update enrollment to paid
    const enrollment = await Enrollment.findOneAndUpdate(
      {
        userId: req.user._id,
        courseId: req.params.id,
        razorpayOrderId,
      },
      {
        paymentStatus: "paid",
        paymentId: razorpayPaymentId,
        enrolledAt: new Date(),
      },
      { new: true }
    );

    if (!enrollment) {
      return res.status(404).json({ error: "Enrollment not found" });
    }

    return res.status(200).json({ enrollment });
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

module.exports = {
  listCourses,
  getCourseDetail,
  enrollInCourse,
  verifyEnrollmentPayment,
  getLesson,
};
