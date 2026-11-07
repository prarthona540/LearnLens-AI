import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Ensure the local uploads directory exists
const uploadDir = path.resolve('uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Allowed audio MIME types and extensions
const ALLOWED_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
  'audio/mp4',
  'audio/ogg',
  'audio/webm',
];

const ALLOWED_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.webm'];

// Disk storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Sanitize filename and append unique timestamp
    const safeName = file.originalname
      .toLowerCase()
      .replace(/[^a-z0-9.]/g, '-')
      .replace(/-+/g, '-');
    const ext = path.extname(safeName);
    const base = path.basename(safeName, ext);
    cb(null, `${base}-${Date.now()}${ext}`);
  },
});

// File filter for validating audio formats
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const isMimeValid = ALLOWED_MIME_TYPES.includes(file.mimetype);
  const isExtValid = ALLOWED_EXTENSIONS.includes(ext);

  if (isMimeValid || isExtValid) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Unsupported audio format (${file.mimetype}). Supported formats: MP3, WAV, M4A, AAC, OGG, WEBM.`
      ),
      false
    );
  }
};

// Maximum audio file size (default: 25MB)
const MAX_FILE_SIZE = (parseInt(process.env.MAX_AUDIO_SIZE_MB, 10) || 25) * 1024 * 1024;

export const uploadAudio = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter,
});
