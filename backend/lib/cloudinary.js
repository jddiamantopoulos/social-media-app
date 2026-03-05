/**
 * Initializes and exports a configured Cloudinary client.
 *
 * Reads credentials from environment variables and provides
 * a shared instance for handling image uploads and asset
 * management across the application.
 */
const { v2: cloudinary } = require("cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

module.exports = { cloudinary };
