const multer = require("multer");

/**
 * Memory storage -- files are kept in memory as Buffer objects so they
 * can be streamed directly to Cloudinary without touching the file system.
 */
const storage = multer.memoryStorage();

/**
 * File filter: accept only image/* MIME types.
 */
const imageFilter = (_req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed."), false);
  }
};

/**
 * File filter: accept only video/* MIME types.
 */
const videoFilter = (_req, file, cb) => {
  if (file.mimetype.startsWith("video/")) {
    cb(null, true);
  } else {
    cb(new Error("Only video files are allowed."), false);
  }
};

/**
 * Upload middleware for a single image.
 * Field name: "image"
 * Max file size: 5 MB
 */
const uploadImage = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
}).single("image");

/**
 * Upload middleware for a single video.
 * Field name: "video"
 * Max file size: 100 MB
 */
const uploadVideo = multer({
  storage,
  fileFilter: videoFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
}).single("video");

module.exports = { uploadImage, uploadVideo };
