import PredictedPaper from '../models/PredictedPaper.js';
import { analyzeExamTrendsAndPredict } from '../services/predictionService.js';

/**
 * @desc    Generate predicted exam paper from past question papers (PYQs)
 * @route   POST /api/predictions/generate
 * @access  Private
 */
export const generatePrediction = async (req, res) => {
  try {
    const { subjectName, pyqTexts } = req.body;

    if (!subjectName || !subjectName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a subject or course name',
      });
    }

    if (!pyqTexts || (typeof pyqTexts === 'string' && !pyqTexts.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Please provide historical exam paper text (PYQs) for trend analysis',
      });
    }

    // Run predictive analysis via Gemini
    const analysis = await analyzeExamTrendsAndPredict(pyqTexts, subjectName.trim());

    // Save PredictedPaper to MongoDB
    const paper = await PredictedPaper.create({
      userId: req.user._id,
      subjectName: subjectName.trim(),
      confidenceScore: analysis.confidenceScore,
      highYieldTopics: analysis.highYieldTopics,
      predictedQuestions: analysis.predictedQuestions,
      rawHistoricalInputSample:
        typeof pyqTexts === 'string'
          ? pyqTexts.slice(0, 500)
          : JSON.stringify(pyqTexts).slice(0, 500),
    });

    return res.status(201).json({
      success: true,
      message: 'Predicted question paper generated successfully',
      paper,
    });
  } catch (error) {
    console.error(`[Prediction Controller Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while generating exam prediction',
    });
  }
};

/**
 * @desc    Get user's history of predicted exam papers
 * @route   GET /api/predictions
 * @access  Private
 */
export const getUserPredictions = async (req, res) => {
  try {
    const papers = await PredictedPaper.find({ userId: req.user._id }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      count: papers.length,
      papers,
    });
  } catch (error) {
    console.error(`[Get Predictions Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while fetching predicted papers',
    });
  }
};

/**
 * @desc    Get single predicted paper by ID
 * @route   GET /api/predictions/:id
 * @access  Private
 */
export const getPredictionById = async (req, res) => {
  try {
    const paper = await PredictedPaper.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!paper) {
      return res.status(404).json({
        success: false,
        message: 'Predicted paper not found or unauthorized',
      });
    }

    return res.status(200).json({
      success: true,
      paper,
    });
  } catch (error) {
    console.error(`[Get Prediction Detail Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while fetching predicted paper',
    });
  }
};
