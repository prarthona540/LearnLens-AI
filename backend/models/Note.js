import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Note must belong to a user'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Please provide a title for the note'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    rawContent: {
      type: String,
      required: [true, 'Please provide the raw content of the note'],
    },
    summary: {
      type: String,
      default: '',
    },
    keyConcepts: {
      type: [String],
      default: [],
    },
    weakTopicsIdentified: {
      type: [String],
      default: [],
    },
    tags: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Index for full-text search across titles and raw content
noteSchema.index({ title: 'text', rawContent: 'text', keyConcepts: 'text' });

const Note = mongoose.model('Note', noteSchema);

export default Note;
