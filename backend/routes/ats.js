const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { ATSReport } = require('../models/ResumeModels');
const { calculateATSScore } = require('../services/atsService');
const { extractText } = require('../utils/fileParser');

// POST /api/ats/score
router.post('/score', protect, upload.single('resume'), async (req, res) => {
  try {
    const { jobDescription } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Resume file is required' });
    }

    const resumeText = await extractText(req.file.buffer, req.file.mimetype);

    if (!resumeText || resumeText.trim().length < 50) {
      return res.status(400).json({ error: 'Could not extract text from resume.' });
    }

    const report = calculateATSScore(resumeText, jobDescription || '');

    const saved = await ATSReport.create({
      userId: req.user._id,
      jobDescription: jobDescription || '',
      resumeText,
      fileName: req.file.originalname,
      ...report,
    });

    res.json({
      reportId: saved._id,
      fileName: req.file.originalname,
      ...report,
    });
  } catch (err) {
    console.error('ATS score error:', err);
    res.status(500).json({ error: 'ATS scoring failed', details: err.message });
  }
});

// GET /api/ats/history
router.get('/history', protect, async (req, res) => {
  try {
    const reports = await ATSReport.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .select('-resumeText')
      .limit(10);
    res.json({ reports });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

module.exports = router;
