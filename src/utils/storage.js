const path = require("path");
const {
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const r2Client = require("../config/r2");

const BUCKET = process.env.R2_BUCKET_NAME || "art-verse";
const PUBLIC_URL = (
  process.env.R2_PUBLIC_URL ||
  "https://pub-6fda4404cd874566840b8615836ae613.r2.dev"
).replace(/\/$/, "");

/**
 * Upload a file buffer to R2.
 *
 * @param {{ buffer: Buffer, mimetype: string, originalname: string }} file
 * @param {string} folder   - Logical folder prefix, e.g. "artworks" or "lessons"
 * @param {object} [opts]
 * @param {Buffer} [opts.processedBuffer] - Pre-processed buffer to upload instead
 *                                          of file.buffer (used for watermarked images)
 * @param {string} [opts.contentType]     - Override content type (e.g. "image/jpeg"
 *                                          after sharp converts to JPEG)
 * @returns {Promise<{ url: string, key: string }>}
 *   url  - Public URL to access the file
 *   key  - R2 object key (store this to delete the file later)
 */
async function uploadFile(file, folder, opts = {}) {
  const body = opts.processedBuffer || file.buffer;
  const contentType = opts.contentType || file.mimetype;
  const ext =
    opts.contentType === "image/jpeg"
      ? ".jpg"
      : path.extname(file.originalname) || `.${file.mimetype.split("/")[1]}`;
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const key = `${folder}/${uniqueSuffix}${ext}`;

  await r2Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  return {
    url: `${PUBLIC_URL}/${key}`,
    key,
  };
}

/**
 * Delete a file from R2 by its object key.
 * Silently ignores missing keys.
 *
 * @param {string} key - The R2 object key returned by uploadFile
 */
async function deleteFile(key) {
  if (!key) return;
  try {
    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: key,
      })
    );
  } catch (err) {
    // Log but don't throw — a missing object shouldn't block the operation
    console.warn(`[storage] Could not delete R2 key "${key}":`, err.message);
  }
}

/**
 * Generate a short-lived presigned GET URL for a private object.
 * Useful for video lessons that should only be accessible to enrolled users.
 *
 * @param {string} key         - The R2 object key
 * @param {number} [expiresIn] - Seconds until the URL expires (default 1 hour)
 * @returns {Promise<string>}
 */
async function getPresignedUrl(key, expiresIn = 3600) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(r2Client, command, { expiresIn });
}

module.exports = { uploadFile, deleteFile, getPresignedUrl };
