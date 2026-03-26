const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const InterviewSession = require('../models/InterviewSession');
const groqService = require('../services/groqService');
const ttsService = require('../services/ttsService');

// POST /api/interview/generate
// Generate 5 questions + TTS audio
router.post('/generate', protect, async (req, res) => {
  try {
    const { jobTitle, jobDescription, skills, yearsOfExperience } = req.body;
    if (!jobTitle || !jobDescription || yearsOfExperience === undefined) {
      return res.status(400).json({ error: 'jobTitle, jobDescription, and yearsOfExperience are required' });
    }

    // Generate questions via Groq
    const generatedQuestions = await groqService.generateInterviewQuestions({
      jobTitle, jobDescription, skills, yearsOfExperience,
    });

    // Generate TTS for each question (parallel)
    const questionsWithAudio = await Promise.all(
      generatedQuestions.map(async (q) => {
        const audioBase64 = await ttsService.textToSpeech(q.question);
        return { ...q, audioBase64 }; // null if TTS not configured
      })
    );

    // Create session in DB
    const session = await InterviewSession.create({
      userId: req.user._id,
      jobTitle,
      jobDescription,
      skills: skills || [],
      yearsOfExperience,
      questions: questionsWithAudio.map(q => ({ question: q.question })),
      status: 'in_progress',
    });

    res.json({
      sessionId: session._id,
      questions: questionsWithAudio,
    });
  } catch (err) {
    console.error('Interview generate error:', err);
    res.status(500).json({ error: 'Failed to generate interview', details: err.message });
  }
});

// POST /api/interview/:sessionId/submit
// Submit answers and get feedback
router.post('/:sessionId/submit', protect, async (req, res) => {
  try {
    const { answers } = req.body; // [{ questionId, answer }]
    const session = await InterviewSession.findOne({
      _id: req.params.sessionId,
      userId: req.user._id,
    });

    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Update answers in session
    const updatedQuestions = session.questions.map((q, i) => ({
      ...q.toObject(),
      userAnswer: answers[i]?.answer || '',
    }));

    // Get overall feedback from Groq
    const feedback = await groqService.generateInterviewFeedback(updatedQuestions);

    session.questions = updatedQuestions;
    session.status = 'completed';
    session.overallFeedback = feedback.summary;
    session.score = feedback.score;
    session.completedAt = new Date();
    await session.save();

    res.json({ feedback, sessionId: session._id });
  } catch (err) {
    console.error('Interview submit error:', err);
    res.status(500).json({ error: 'Failed to submit interview', details: err.message });
  }
});

// GET /api/interview/history
router.get('/history', protect, async (req, res) => {
  try {
    const sessions = await InterviewSession.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .select('-questions.audioBase64')
      .limit(20);
    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// GET /api/interview/:sessionId
router.get('/:sessionId', protect, async (req, res) => {
  try {
    const session = await InterviewSession.findOne({
      _id: req.params.sessionId,
      userId: req.user._id,
    });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({ session });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

module.exports = router;
