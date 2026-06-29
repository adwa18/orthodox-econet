// backend/src/config/cloudinary.js
// Cloudinary v2 SDK config.
// Files are streamed from memory (multer memoryStorage) directly to Cloudinary —
// no temp files written to Render's ephemeral disk.

const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

/**
 * Upload a file buffer to Cloudinary via a readable stream.
 * @param {Buffer} buffer         - File buffer from multer
 * @param {object} options        - Cloudinary upload options
 * @param {string} options.folder - Cloudinary folder name
 * @param {string} [options.resource_type] - 'image' | 'raw' | 'auto'
 * @returns {Promise<object>} Cloudinary upload result
 */
function uploadStream(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder:        options.folder || 'orthodox-econet',
      resource_type: options.resource_type || 'auto',
      ...options,
    };

    const stream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    streamifier.createReadStream(buffer).pipe(stream);
  });
}

/**
 * Delete a file from Cloudinary by its public ID.
 * @param {string} publicId
 * @param {string} [resourceType='image']
 */
async function deleteFile(publicId, resourceType = 'image') {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    // Non-fatal — log but don't crash the request
    console.error('[Cloudinary] Delete failed:', publicId, err.message);
  }
}

/**
 * Determine the Cloudinary folder based on context.
 * @param {'post'|'announcement'|'marketplace'|'professional'|'donation'|'settings'} context
 */
function getFolder(context) {
  return `orthodox-econet/${context}`;
}

module.exports = { cloudinary, uploadStream, deleteFile, getFolder };
