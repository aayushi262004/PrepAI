const mongoose = require('mongoose')

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
})

const careerChatSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Whether the user has embedded a resume into ChromaDB for this session
  resumeEmbedded: { type: Boolean, default: false },
  resumeFileName: { type: String, default: '' },
  messages: [messageSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})

module.exports = mongoose.model('CareerChat', careerChatSchema)
