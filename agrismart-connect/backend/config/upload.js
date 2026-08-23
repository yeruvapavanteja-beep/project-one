// ============================================================
// Multer configuration for secure image uploads
// (crop photos, growth-update photos, profile images)
// ============================================================
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const UPLOAD_ROOT = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
const MAX_SIZE = (parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 5) * 1024 * 1024;

// Ensure subfolders exist
['crops', 'growth', 'profiles'].forEach((sub) => {
  const dir = path.join(UPLOAD_ROOT, sub);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function storageFor(subfolder) {
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(UPLOAD_ROOT, subfolder)),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeName = `${subfolder}_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, safeName);
    }
  });
}

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME.includes(file.mimetype)) {
    return cb(new Error('Only JPEG, PNG, or WEBP image files are allowed.'));
  }
  cb(null, true);
}

function makeUploader(subfolder) {
  return multer({
    storage: storageFor(subfolder),
    fileFilter,
    limits: { fileSize: MAX_SIZE }
  });
}

module.exports = {
  uploadCropImage: makeUploader('crops'),
  uploadGrowthImage: makeUploader('growth'),
  uploadProfileImage: makeUploader('profiles'),
  UPLOAD_ROOT
};
