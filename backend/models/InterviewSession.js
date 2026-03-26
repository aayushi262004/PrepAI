const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  question: String,
  audioUrl: String,    // URL to TTS audio file (or base64)
  userAnswer: String,  // Captured via speech-to-text or typed
  feedback: String,    // Optional AI feedback per question
});

const interviewSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  jobTitle: { type: String, required: true },
  jobDescription: { type: String, required: true },
  skills: [String],
  yearsOfExperience: { type: Number, required: true },
  questions: [questionSchema],
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed'],
    default: 'pending',
  },
  overallFeedback: String,
  score: { type: Number, min: 0, max: 100 },
  completedAt: Date,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('InterviewSession', interviewSessionSchema);
