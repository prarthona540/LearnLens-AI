import express from 'express';
import multer from 'multer';
import { analyzeAudio } from '../controllers/audioController.js';
import { protect } from '../middleware/authMiddleware.js';
import { uploadAudio } from '../middleware/uploadMiddleware.js';

const router = express.Router();

/**
 * All audio routes require authentication
 */
router.use(protect);

/**
 * Custom wrapper for uploadAudio to catch Multer errors (file size, format)
 * and return clear 400 JSON responses.
 */
const handleAudioUpload = (req, res, next) => {
  const upload = uploadAudio.single('audio');

  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Audio file is too large. Maximum supported size is 25MB.',
        });
      }
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`,
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
    next();
  });
};

/**
 * @route   POST /api/audio/analyze
 * @desc    Upload lecture audio file (MP3/WAV/M4A), transcribe & generate structured notes
 * @access  Private
 */
router.post('/analyze', handleAudioUpload, analyzeAudio);

export default router;
