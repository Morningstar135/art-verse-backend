const sharp = require("sharp");

/**
 * Default watermark text. Override via env WATERMARK_TEXT.
 */
const WATERMARK_TEXT = process.env.WATERMARK_TEXT || "ArtVerse";

/**
 * Apply a semi-transparent diagonal watermark across the entire image.
 *
 * The watermark is rendered as white text with low opacity, tiled
 * diagonally so it covers the full canvas — making it hard to crop out
 * while keeping the artwork clearly visible.
 *
 * @param {Buffer} imageBuffer - The raw image file buffer
 * @param {object}  [opts]
 * @param {string}  [opts.text]    - Watermark text (default: WATERMARK_TEXT)
 * @param {number}  [opts.opacity] - 0–1, watermark opacity (default: 0.15)
 * @returns {Promise<Buffer>} The watermarked image as a JPEG/WebP buffer
 */
async function addWatermark(imageBuffer, opts = {}) {
  const text = opts.text || WATERMARK_TEXT;
  const opacity = opts.opacity ?? 0.15;

  // Read image metadata so we know its dimensions
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();
  const { width, height } = metadata;

  if (!width || !height) {
    // Can't determine size — return untouched
    return imageBuffer;
  }

  // Scale font size relative to image width (roughly 3-4% of width)
  const fontSize = Math.max(24, Math.round(width * 0.035));
  const lineHeight = fontSize * 2.8;

  // We create a large SVG with repeated diagonal text
  const rows = Math.ceil(height / lineHeight) + 4;
  const cols = Math.ceil(width / (text.length * fontSize * 0.5)) + 2;

  let textElements = "";
  for (let row = -2; row < rows; row++) {
    for (let col = -1; col < cols; col++) {
      const x = col * (text.length * fontSize * 0.55);
      const y = row * lineHeight;
      textElements += `<text x="${x}" y="${y}" font-size="${fontSize}" font-family="Arial, Helvetica, sans-serif" font-weight="600" fill="white" opacity="${opacity}" transform="rotate(-30, ${x}, ${y})">${text}</text>\n`;
    }
  }

  const svgOverlay = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      ${textElements}
    </svg>
  `);

  const result = await sharp(imageBuffer)
    .composite([{ input: svgOverlay, top: 0, left: 0 }])
    .jpeg({ quality: 90 })
    .toBuffer();

  return result;
}

module.exports = { addWatermark };
