const { S3Client } = require("@aws-sdk/client-s3");

/**
 * Cloudflare R2 client (S3-compatible).
 *
 * Key compatibility settings for R2:
 *  - forcePathStyle: true     → R2 doesn't support virtual-hosted-style URLs
 *  - requestChecksumCalculation / responseChecksumValidation → "WHEN_REQUIRED"
 *      AWS SDK v3.600+ sends CRC32 checksums by default; R2 doesn't support
 *      them and returns AccessDenied. Disabling auto-checksums fixes this.
 *
 * Required env vars:
 *   - R2_ACCOUNT_ID
 *   - R2_ACCESS_KEY_ID
 *   - R2_SECRET_ACCESS_KEY
 */
const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

module.exports = r2Client;
