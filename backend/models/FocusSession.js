import mongoose from 'mongoose';

const focusSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    durationMinutes: {
      type: Number,
      required: [true, 'Please provide the session duration in minutes'],
      min: [1, 'Session duration must be at least 1 minute'],
      max: [300, 'Session duration cannot exceed 300 minutes'],
    },
    focusScore: {
      type: Number,
      required: [true, 'Please provide a focus score between 0 and 100'],
      min: [0, 'Focus score cannot be less than 0'],
      max: [100, 'Focus score cannot exceed 100'],
      default: 80,
    },
    moodState: {
      type: String,
      required: [true, 'Please provide a mood state'],
      enum: {
        values: ['Focused', 'Tired', 'Anxious', 'Energized', 'Distracted'],
        message: '{VALUE} is not a valid mood state',
      },
      default: 'Focused',
    },
    distractionCount: {
      type: Number,
      default: 0,
      min: [0, 'Distraction count cannot be negative'],
    },
    subjectTopic: {
      type: String,
      default: 'General Study',
      trim: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const FocusSession = mongoose.model('FocusSession', focusSessionSchema);

export default FocusSession;
