const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { ResumeReport } = require('../models/ResumeModels');
const { generateReport } = require('../services/nlpService');
const { extractText } = require('../utils/fileParser');

router.post('/analyze', protect, upload.single('resume'), async (req, res) => {
  try {
    const { jobDescription } = req.body;
    if (!req.file) return res.status(400).json({ error: 'Resume file is required' });

    const resumeText = await extractText(req.file.buffer, req.file.mimetype);
    if (!resumeText || resumeText.trim().length < 50)
      return res.status(400).json({ error: 'Could not extract text from resume.' });

    const report = await generateReport(resumeText, jobDescription || '');

    await ResumeReport.create({
      userId: req.user._id,
      jobDescription: jobDescription || '',
      resumeText,
      fileName: req.file.originalname,
      score: report.score,
      sectionScores: {
        skillsMatch: report.section_scores?.skills_match,
        experienceRelevance: report.section_scores?.experience_relevance,
        educationFit: report.section_scores?.education_fit,
        keywords: report.section_scores?.keywords,
        formatting: report.section_scores?.formatting,
      },
      matchedKeywords: report.matched_keywords || [],
      missingKeywords: report.missing_keywords || [],
      formattingIssues: report.formatting_issues || [],
      strengths: report.strengths || [],
      recommendations: report.recommendations || [],
      summary: report.summary || '',
      experienceGap: report.experience_gap || '',
      toneFeedback: report.tone_feedback || '',
      semanticMatchScore: report.semantic_match_score ?? undefined,
    });

    res.json({
      fileName: req.file.originalname,
      score: report.score,
      sectionScores: report.section_scores,
      matchedKeywords: report.matched_keywords || [],
      missingKeywords: report.missing_keywords || [],
      formattingIssues: report.formatting_issues || [],
      strengths: report.strengths || [],
      recommendations: report.recommendations || [],
      summary: report.summary || '',
      experienceGap: report.experience_gap || '',
      toneFeedback: report.tone_feedback || '',
      semanticMatchScore: report.semantic_match_score ?? null,
    });
  } catch (err) {
    console.error('Resume report error:', err);
    res.status(500).json({ error: err.message || 'Resume analysis failed' });
  }
});

router.get('/history', protect, async (req, res) => {
  try {
    const reports = await ResumeReport.find({ userId: req.user._id })
      .sort({ createdAt: -1 }).select('-resumeText').limit(10);
    res.json({ reports });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

module.exports = router;
