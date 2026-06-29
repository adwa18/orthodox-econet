// backend/src/middleware/upload.js
// Multer configuration with Cloudinary streaming.
// Uses memoryStorage — no files ever touch Render's ephemeral disk.

const multer  = require('multer');
const { uploadStream, getFolder } = require('../config/cloudinary');

// ─── MIME type whitelist ───────────────────────────────────────────────────────

const ALLOWED_MIMES = new Set([
  // Images
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
]);

const IMAGE_ONLY_MIMES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
]);

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

// ─── Multer instances ─────────────────────────────────────────────────────────

/** For posts and announcements — images + documents */
const postUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    ALLOWED_MIMES.has(file.mimetype)
      ? cb(null, true)
      : cb(new Error(`File type not allowed: ${file.mimetype}`));
  },
});

/** For marketplace listings — images only */
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB for images
  fileFilter: (_req, file, cb) => {
    IMAGE_ONLY_MIMES.has(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Images only (JPEG, PNG, GIF, WebP)'));
  },
});

// ─── Cloudinary upload helper ─────────────────────────────────────────────────

/**
 * Upload an array of multer files to Cloudinary.
 * @param {Express.Multer.File[]} files
 * @param {'post'|'marketplace'|'professional'|'donation'|'settings'|'announcement'} context
 * @returns {Promise<Array<{url, publicId, filename, mimetype, size, type}>>}
 */
async function uploadFiles(files, context) {
  if (!files || files.length === 0) return [];

  const uploads = await Promise.all(
    files.map(async (file) => {
      const isImage    = IMAGE_ONLY_MIMES.has(file.mimetype);
      const resourceType = isImage ? 'image' : 'raw';

      const result = await uploadStream(file.buffer, {
        folder:        getFolder(context),
        resource_type: resourceType,
        public_id:     `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`,
      });

      return {
        url:       result.secure_url,
        publicId:  result.public_id,
        filename:  file.originalname,
        mimetype:  file.mimetype,
        size:      file.size,
        type:      isImage ? 'image' : 'document',
      };
    })
  );

  return uploads;
}

// ─── Multer error handler ─────────────────────────────────────────────────────

/**
 * Express error middleware for multer errors.
 * Place AFTER route handlers that use multer.
 */
function handleUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 50 MB.' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err && err.message) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
}

module.exports = {
  postUpload,
  imageUpload,
  uploadFiles,
  handleUploadError,
  MAX_FILE_SIZE,
  ALLOWED_MIMES,
};
