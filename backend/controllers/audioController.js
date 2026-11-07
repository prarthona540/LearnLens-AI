import fs from 'fs';
import path from 'path';
import Note from '../models/Note.js';
import { analyzeLectureAudio } from '../services/audioService.js';

/**
 * @desc    Upload lecture audio, transcribe, extract structured notes & quiz preview
 * @route   POST /api/audio/analyze
 * @access  Private
 */
export const analyzeAudio = async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({
      success: false,
      message: 'No audio file uploaded. Please provide an audio file with field name "audio"',
    });
  }

  const filePath = file.path;

  try {
    // 1. Process audio via Google Gemini Multimodal pipeline
    const analysis = await analyzeLectureAudio(filePath, file.mimetype);

    // 2. Format title from request body or original filename
    const parsedName = path.parse(file.originalname).name.replace(/[-_]/g, ' ');
    const title =
      req.body.title && req.body.title.trim().length > 0
        ? req.body.title.trim()
        : `Lecture: ${parsedName.charAt(0).toUpperCase() + parsedName.slice(1)}`;

    // 3. Save resulting structured note in MongoDB
    const note = await Note.create({
      userId: req.user._id,
      title,
      rawContent: analysis.structuredNotes,
      summary: analysis.transcriptionSummary,
      keyConcepts: analysis.keyConcepts,
      weakTopicsIdentified: [],
      tags: ['Voice-to-Note', 'Audio Lecture', file.mimetype.split('/')[1] || 'audio'],
    });

    return res.status(201).json({
      success: true,
      message: 'Audio lecture transcribed and note created successfully',
      note,
      analysis: {
        transcriptionSummary: analysis.transcriptionSummary,
        keyConcepts: analysis.keyConcepts,
        structuredNotes: analysis.structuredNotes,
        instantQuizPreview: analysis.instantQuizPreview,
      },
    });
  } catch (error) {
    console.error(`[Audio Controller Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while analyzing lecture audio',
    });
  } finally {
    // Clean up temporary audio file from disk to prevent storage leaks
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (cleanupError) {
        console.warn(`[Audio Cleanup Warning]: Could not delete ${filePath}: ${cleanupError.message}`);
      }
    }
  }
};
