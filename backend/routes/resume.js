const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { ResumeAnalysis } = require('../models/ResumeModels');
const nlpService = require('../services/nlpService');
const { extractText } = require('../utils/fileParser');

// POST /api/resume/analyze
// Upload resume + job description → get skill gap analysis
router.post('/analyze', protect, upload.single('resume'), async (req, res) => {
  try {
    const { jobDescription } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Resume file is required' });
    }
    if (!jobDescription) {
      return res.status(400).json({ error: 'Job description is required' });
    }

    // Extract text from file
    const resumeText = await extractText(req.file.buffer, req.file.mimetype);

    if (!resumeText || resumeText.trim().length < 50) {
      return res.status(400).json({ error: 'Could not extract text from resume. Ensure the file is not a scanned image.' });
    }

    // Call NLP service for analysis
    const analysis = await nlpService.analyzeResume(resumeText, jobDescription);

    // Save to DB
    const saved = await ResumeAnalysis.create({
      userId: req.user._id,
      jobDescription,
      resumeText,
      fileName: req.file.originalname,
      matchScore: analysis.match_score,
      missingSkills: analysis.missing_skills || [],
      matchedSkills: analysis.matched_skills || [],
      suggestions: analysis.suggestions || [],
      summaryFeedback: analysis.summary_feedback || '',
    });

    res.json({
      analysisId: saved._id,
      matchScore: saved.matchScore,
      missingSkills: saved.missingSkills,
      matchedSkills: saved.matchedSkills,
      suggestions: saved.suggestions,
      summaryFeedback: saved.summaryFeedback,
      fileName: saved.fileName,
    });
  } catch (err) {
    console.error('Resume analyze error:', err);
    res.status(500).json({ error: 'Analysis failed', details: err.message });
  }
});

// GET /api/resume/history
router.get('/history', protect, async (req, res) => {
  try {
    const analyses = await ResumeAnalysis.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .select('-resumeText')
      .limit(10);
    res.json({ analyses });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

module.exports = router;
