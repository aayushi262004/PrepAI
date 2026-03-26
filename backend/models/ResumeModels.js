const mongoose = require('mongoose');

// ─── Resume Analysis Model ────────────────────────────────────────────────
const resumeAnalysisSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  jobDescription: { type: String, required: true },
  resumeText: String,
  fileName: String,

  // NLP analysis results
  matchScore: { type: Number, min: 0, max: 100 },          // Semantic similarity %
  missingSkills: [String],                                   // Skills in JD but not resume
  matchedSkills: [String],                                   // Skills in both
  suggestions: [String],                                     // Actionable improvement tips
  summaryFeedback: String,                                   // Overall paragraph

  createdAt: { type: Date, default: Date.now },
});

// ─── ATS Score Model ──────────────────────────────────────────────────────
const atsReportSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  jobDescription: String,   // optional JD for targeted ATS
  resumeText: String,
  fileName: String,

  atsScore: { type: Number, min: 0, max: 100 },
  keywordsFound: [String],
  keywordsMissing: [String],
  formattingIssues: [String],
  sectionPresence: {
    hasContactInfo: Boolean,
    hasSummary: Boolean,
    hasExperience: Boolean,
    hasEducation: Boolean,
    hasSkills: Boolean,
    hasProjects: Boolean,
  },
  recommendations: [String],

  createdAt: { type: Date, default: Date.now },
});

module.exports = {
  ResumeAnalysis: mongoose.model('ResumeAnalysis', resumeAnalysisSchema),
  ATSReport: mongoose.model('ATSReport', atsReportSchema),
};
