const express = require('express')
const router = express.Router()
const axios = require('axios')
const { protect } = require('../middleware/auth')
const upload = require('../middleware/upload')
const CareerChat = require('../models/CareerChat')
const { extractText } = require('../utils/fileParser')

const NLP_URL = process.env.NLP_SERVICE_URL || 'http://localhost:8001'

// ─── POST /api/career/embed ───────────────────────────────────────────────────
// Upload resume → extract text → send to NLP service to chunk + embed + store
router.post('/embed', protect, upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Resume file is required' })

    const resumeText = await extractText(req.file.buffer, req.file.mimetype)
    if (!resumeText || resumeText.trim().length < 50)
      return res.status(400).json({ error: 'Could not extract text from resume' })

    // Send to Python NLP service to embed and store in ChromaDB
    // user_id is used as namespace key in ChromaDB
    const nlpRes = await axios.post(`${NLP_URL}/embed`, {
      user_id: req.user._id.toString(),
      resume_text: resumeText,
    }, { timeout: 60000 })

    // Create or reset chat session in MongoDB
    await CareerChat.findOneAndUpdate(
      { userId: req.user._id },
      {
        userId: req.user._id,
        resumeEmbedded: true,
        resumeFileName: req.file.originalname,
        messages: [{
          role: 'assistant',
          content: `I've read your resume **${req.file.originalname}** and stored it as ${nlpRes.data.chunks_stored} searchable sections. Ask me anything about your career, skills, or how to improve your resume for specific roles!`,
        }],
        updatedAt: new Date(),
      },
      { upsert: true, new: true }
    )

    res.json({
      chunksStored: nlpRes.data.chunks_stored,
      message: nlpRes.data.message,
      fileName: req.file.originalname,
    })
  } catch (err) {
    console.error('Career embed error:', err.message)
    res.status(500).json({ error: err.response?.data?.detail || err.message || 'Embedding failed' })
  }
})

// ─── POST /api/career/chat ────────────────────────────────────────────────────
// Send message → RAG retrieval → LLM answer → save to MongoDB history
router.post('/chat', protect, async (req, res) => {
  try {
    const { message } = req.body
    if (!message?.trim()) return res.status(400).json({ error: 'Message is required' })

    // Get existing chat session
    let session = await CareerChat.findOne({ userId: req.user._id })

    if (!session || !session.resumeEmbedded) {
      return res.status(400).json({
        error: 'Please upload your resume first before starting the chat.'
      })
    }

    // Build chat history to send to NLP service (last 6 messages for context)
    const historyForNLP = session.messages
      .slice(-6)
      .map(m => ({ role: m.role, content: m.content }))

    // Call NLP RAG endpoint
    const nlpRes = await axios.post(`${NLP_URL}/chat`, {
      user_id: req.user._id.toString(),
      message: message.trim(),
      chat_history: historyForNLP,
    }, { timeout: 45000 })

    const assistantReply = nlpRes.data.answer

    // Save both messages to MongoDB
    session.messages.push({ role: 'user', content: message.trim() })
    session.messages.push({ role: 'assistant', content: assistantReply })
    session.updatedAt = new Date()

    // Keep only last 50 messages to avoid doc bloat
    if (session.messages.length > 50) {
      session.messages = session.messages.slice(-50)
    }

    await session.save()

    res.json({
      answer: assistantReply,
      sources: nlpRes.data.sources || [],
    })
  } catch (err) {
    console.error('Career chat error:', err.message)
    res.status(500).json({ error: err.response?.data?.detail || err.message || 'Chat failed' })
  }
})

// ─── GET /api/career/session ──────────────────────────────────────────────────
// Load existing chat history when user opens the page
router.get('/session', protect, async (req, res) => {
  try {
    const session = await CareerChat.findOne({ userId: req.user._id })
    if (!session) return res.json({ exists: false, messages: [], resumeEmbedded: false })
    res.json({
      exists: true,
      resumeEmbedded: session.resumeEmbedded,
      resumeFileName: session.resumeFileName,
      messages: session.messages,
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to load session' })
  }
})

// ─── DELETE /api/career/session ───────────────────────────────────────────────
// Clear chat and re-upload resume
router.delete('/session', protect, async (req, res) => {
  try {
    // Clear ChromaDB embeddings for this user
    await axios.delete(`${NLP_URL}/embed/${req.user._id.toString()}`)
      .catch(() => {}) // don't fail if NLP service errors

    // Clear MongoDB session
    await CareerChat.findOneAndDelete({ userId: req.user._id })

    res.json({ message: 'Session cleared' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear session' })
  }
})

module.exports = router
