const Course = require("../../models/Course");
const Enrollment = require("../../models/Enrollment");
const { uploadFile, deleteFile } = require("../../utils/storage");

/**
 * GET /api/admin/courses
 * List all courses (published and unpublished).
 */
const list = async (req, res, next) => {
  try {
    const courses = await Course.find().sort({ createdAt: -1 }).lean();

    const formatted = courses.map((course) => ({
      id: course._id,
      title: course.title,
      description: course.description,
      thumbnailUrl: course.thumbnailUrl,
      price: course.price,
      isPublished: course.isPublished,
      lessonCount: (course.lessons || []).length,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
    }));

    return res.status(200).json({ courses: formatted });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/courses
 * Create a new course with optional thumbnail upload.
 */
const create = async (req, res, next) => {
  try {
    const { title, description, price, curriculum, isPublished } = req.body;

    if (!title || !description || price === undefined) {
      return res
        .status(400)
        .json({ error: "Title, description, and price are required" });
    }

    let thumbnailUrl;
    let thumbnailPublicId;

    if (req.file) {
      const { url, key } = await uploadFile(req.file, "courses");
      thumbnailUrl = url;
      thumbnailPublicId = key;
    }

    const course = new Course({
      title,
      description,
      thumbnailUrl,
      thumbnailPublicId,
      price: parseInt(price, 10),
      curriculum,
      isPublished: isPublished === "true" || isPublished === true,
    });

    await course.save();

    return res.status(201).json({
      id: course._id,
      title: course.title,
      description: course.description,
      thumbnailUrl: course.thumbnailUrl,
      price: course.price,
      curriculum: course.curriculum,
      isPublished: course.isPublished,
      lessonCount: 0,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/courses/:id
 * Update a course. Optional new thumbnail upload.
 */
const update = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    const { title, description, price, curriculum, isPublished } = req.body;

    if (title !== undefined) course.title = title;
    if (description !== undefined) course.description = description;
    if (price !== undefined) course.price = parseInt(price, 10);
    if (curriculum !== undefined) course.curriculum = curriculum;
    if (isPublished !== undefined)
      course.isPublished = isPublished === "true" || isPublished === true;

    if (req.file) {
      await deleteFile(course.thumbnailPublicId);
      const { url, key } = await uploadFile(req.file, "courses");
      course.thumbnailUrl = url;
      course.thumbnailPublicId = key;
    }

    await course.save();

    return res.status(200).json({
      id: course._id,
      title: course.title,
      description: course.description,
      thumbnailUrl: course.thumbnailUrl,
      price: course.price,
      curriculum: course.curriculum,
      isPublished: course.isPublished,
      lessonCount: (course.lessons || []).length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/courses/:id
 * Delete a course. Rejected if paid enrollments exist.
 */
const remove = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    const enrollmentCount = await Enrollment.countDocuments({
      courseId: course._id,
      paymentStatus: "paid",
    });

    if (enrollmentCount > 0) {
      return res.status(400).json({
        error: `Cannot delete course. ${enrollmentCount} active enrollment(s) exist.`,
      });
    }

    // Delete thumbnail from R2
    await deleteFile(course.thumbnailPublicId);

    // Delete all lesson videos from R2
    for (const lesson of course.lessons || []) {
      await deleteFile(lesson.videoPublicId);
    }

    await Enrollment.deleteMany({ courseId: course._id });
    await Course.findByIdAndDelete(req.params.id);

    return res.status(200).json({ message: "Course deleted successfully" });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/courses/:id/lessons
 * Add a lesson with optional video upload.
 */
const addLesson = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    const { title, description, duration, sortOrder } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Lesson title is required" });
    }

    let videoUrl;
    let videoPublicId;

    if (req.file) {
      const { url, key } = await uploadFile(req.file, "lessons");
      videoUrl = url;
      videoPublicId = key;
    }

    const newLesson = {
      title,
      description,
      videoUrl,
      videoPublicId,
      duration: duration ? parseInt(duration, 10) : undefined,
      sortOrder: sortOrder
        ? parseInt(sortOrder, 10)
        : (course.lessons || []).length + 1,
    };

    course.lessons.push(newLesson);
    await course.save();

    const addedLesson = course.lessons[course.lessons.length - 1];

    return res.status(201).json({
      lesson: {
        _id: addedLesson._id,
        title: addedLesson.title,
        description: addedLesson.description,
        videoUrl: addedLesson.videoUrl,
        duration: addedLesson.duration,
        sortOrder: addedLesson.sortOrder,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/courses/:id/lessons/:lessonId
 * Update a lesson. Optional new video upload.
 */
const updateLesson = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    const lesson = course.lessons.id(req.params.lessonId);

    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    const { title, description, duration, sortOrder } = req.body;

    if (title !== undefined) lesson.title = title;
    if (description !== undefined) lesson.description = description;
    if (duration !== undefined) lesson.duration = parseInt(duration, 10);
    if (sortOrder !== undefined) lesson.sortOrder = parseInt(sortOrder, 10);

    if (req.file) {
      await deleteFile(lesson.videoPublicId);
      const { url, key } = await uploadFile(req.file, "lessons");
      lesson.videoUrl = url;
      lesson.videoPublicId = key;
    }

    await course.save();

    return res.status(200).json({
      lesson: {
        _id: lesson._id,
        title: lesson.title,
        description: lesson.description,
        videoUrl: lesson.videoUrl,
        duration: lesson.duration,
        sortOrder: lesson.sortOrder,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/courses/:id/lessons/:lessonId
 * Remove a lesson and delete its video from R2.
 */
const removeLesson = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    const lesson = course.lessons.id(req.params.lessonId);

    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    await deleteFile(lesson.videoPublicId);

    lesson.deleteOne();
    await course.save();

    return res.status(200).json({ message: "Lesson deleted successfully" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  list,
  create,
  update,
  remove,
  addLesson,
  updateLesson,
  removeLesson,
};
