const mongoose = require('mongoose');

// ─── Resume Report Model (ATS score + skill-gap analysis, combined) ──────────
const resumeReportSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  jobDescription: String,   // optional — targeted analysis when provided
  resumeText: String,
  fileName: String,

  score: { type: Number, min: 0, max: 100 },
  sectionScores: {
    skillsMatch: Number,
    experienceRelevance: Number,
    educationFit: Number,
    keywords: Number,
    formatting: Number,
  },
  matchedKeywords: [String],
  missingKeywords: [String],
  formattingIssues: [String],
  strengths: [String],
  recommendations: [String],
  summary: String,
  experienceGap: String,   // only meaningful when jobDescription was given
  toneFeedback: String,
  semanticMatchScore: Number,   // ML-computed (embedding similarity), independent of the LLM score — only set when jobDescription was given

  createdAt: { type: Date, default: Date.now },
});

module.exports = {
  ResumeReport: mongoose.model('ResumeReport', resumeReportSchema),
};
