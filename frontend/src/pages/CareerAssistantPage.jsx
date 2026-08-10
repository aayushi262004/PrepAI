import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, FileText, Send, Loader2, RotateCcw,
  Bot, User, Sparkles, ChevronDown
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../utils/api'

// ─── Suggested questions ──────────────────────────────────────────────────────
const SUGGESTIONS = [
  "Am I a good fit for a senior software engineer role?",
  "What skills am I missing for a data science position?",
  "Rewrite my work experience bullets to be more impactful",
  "What should I add to pass ATS for a product manager role?",
  "How strong is my resume for a startup vs big tech?",
  "What certifications would help me most right now?",
]

// ─── File drop zone ───────────────────────────────────────────────────────────
function FileDropZone({ onFile, file, loading }) {
  const [dragging, setDragging] = useState(false)
  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  }
  return (
    <label
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center gap-3 p-10 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 ${loading ? 'opacity-50 cursor-not-allowed pointer-events-none' :
          dragging ? 'border-brand-500 bg-brand-600/10' :
            file ? 'border-emerald-600/40 bg-emerald-600/5' :
              'border-white/10 bg-surface-200 hover:border-brand-600/40 hover:bg-brand-600/5'
        }`}
    >
      <input type="file" accept=".pdf,.doc,.docx" className="hidden" disabled={loading}
        onChange={e => onFile(e.target.files[0])} />
      {loading ? (
        <>
          <Loader2 className="w-10 h-10 text-brand-400 animate-spin" />
          <p className="text-sm font-medium text-brand-300">Reading and embedding your resume...</p>
          <p className="text-xs text-gray-500">This takes about 10–20 seconds</p>
        </>
      ) : file ? (
        <>
          <FileText className="w-10 h-10 text-emerald-400" />
          <p className="text-sm font-medium text-emerald-300">{file.name}</p>
          <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB · Click to change</p>
        </>
      ) : (
        <>
          <div className="w-16 h-16 rounded-2xl bg-brand-600/10 border border-brand-600/20 flex items-center justify-center">
            <Upload className="w-8 h-8 text-brand-400" />
          </div>
          <div className="text-center">
            <p className="text-base font-medium text-gray-200">Drop your resume here</p>
            <p className="text-sm text-gray-500 mt-1">PDF or DOCX · Max 5MB</p>
          </div>
        </>
      )}
    </label>
  )
}

// ─── Message bubble ───────────────────────────────────────────────────────────
function MessageBubble({ msg, isLatest }) {
  const isUser = msg.role === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${isUser ? 'bg-brand-600/30 border border-brand-600/40' : 'bg-violet-600/20 border border-violet-600/30'
        }`}>
        {isUser
          ? <User className="w-4 h-4 text-brand-300" />
          : <Bot className="w-4 h-4 text-violet-300" />
        }
      </div>

      {/* Bubble */}
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${isUser
          ? 'bg-brand-600/20 border border-brand-600/30 text-gray-100 rounded-tr-sm'
          : 'bg-surface-200 border border-white/8 text-gray-200 rounded-tl-sm'
        }`}>
        {/* Render markdown-like formatting */}
        {msg.content.split('\n').map((line, i) => {
          // Bold: **text**
          const boldLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          // Bullet points
          if (line.startsWith('• ') || line.startsWith('- ')) {
            return <div key={i} className="flex gap-2 my-0.5">
              <span className="text-brand-400 flex-shrink-0">•</span>
              <span dangerouslySetInnerHTML={{ __html: boldLine.replace(/^[•\-]\s/, '') }} />
            </div>
          }
          if (line.trim() === '') return <div key={i} className="h-2" />
          return <p key={i} dangerouslySetInnerHTML={{ __html: boldLine }} />
        })}
      </div>
    </motion.div>
  )
}

// ─── Typing indicator ─────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center bg-violet-600/20 border border-violet-600/30">
        <Bot className="w-4 h-4 text-violet-300" />
      </div>
      <div className="bg-surface-200 border border-white/8 rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex gap-1 items-center h-4">
          {[0, 0.2, 0.4].map((d, i) => (
            <motion.div key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full"
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 0.6, delay: d, repeat: Infinity }} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CareerAssistantPage() {
  const [phase, setPhase] = useState('loading') // loading | upload | chat
  const [file, setFile] = useState(null)
  const [embedding, setEmbedding] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [resumeFileName, setResumeFileName] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(true)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  // Load existing session on mount
  useEffect(() => {
    api.get('/career/session')
      .then(res => {
        if (res.data.resumeEmbedded) {
          setMessages(res.data.messages || [])
          setResumeFileName(res.data.resumeFileName || '')
          setPhase('chat')
        } else {
          setPhase('upload')
        }
      })
      .catch(() => setPhase('upload'))
  }, [])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  const handleEmbed = async (selectedFile) => {
    if (!selectedFile) return
    setFile(selectedFile)
    setEmbedding(true)
    try {
      const formData = new FormData()
      formData.append('resume', selectedFile)
      const res = await api.post('/career/embed', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setResumeFileName(selectedFile.name)
      setMessages([{
        role: 'assistant',
        content: res.data.message || `Resume loaded! I've split it into ${res.data.chunksStored} sections. Ask me anything!`
      }])
      setPhase('chat')
      toast.success('Resume embedded! Start chatting.')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to embed resume')
      setFile(null)
    } finally {
      setEmbedding(false)
    }
  }

  const handleSend = async (text) => {
    const msg = (text || input).trim()
    if (!msg || sending) return
    setInput('')
    setShowSuggestions(false)

    // Add user message immediately
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setSending(true)

    try {
      const res = await api.post('/career/chat', { message: msg })
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.answer }])
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to get response')
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I ran into an error. Please try again.'
      }])
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const handleReset = async () => {
    try {
      await api.delete('/career/session')
      setMessages([])
      setFile(null)
      setResumeFileName('')
      setPhase('upload')
      setShowSuggestions(true)
      toast.success('Session cleared')
    } catch {
      toast.error('Failed to clear session')
    }
  }

  // ── Loading ──
  if (phase === 'loading') {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
      </div>
    )
  }

  // ── Upload phase ──
  if (phase === 'upload') {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="page-header mb-0">AI Career Assistant</h1>
          </div>
        </div>
        <p className="page-subheader">
          Upload your resume once — then chat with it. Ask for role-specific advice, skill gap analysis, resume rewrites, and more. Powered by RAG so answers are grounded in <em>your</em> actual resume.
        </p>

        <FileDropZone onFile={handleEmbed} file={file} loading={embedding} />

        {/* What you can ask */}
        <div className="mt-8">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Example questions you can ask</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SUGGESTIONS.map((s, i) => (
              <div key={i} className="flex items-start gap-2 p-3 rounded-xl bg-surface-200 border border-white/5">
                <span className="text-brand-400 text-sm mt-0.5">→</span>
                <span className="text-sm text-gray-400">{s}</span>
              </div>
            ))}
          </div>
        </div>

        {/* RAG explanation */}
        <div className="mt-6 p-4 rounded-xl bg-violet-600/5 border border-violet-600/20">
          <p className="text-xs font-medium text-violet-400 mb-2">How this works (RAG)</p>
          <p className="text-xs text-gray-400 leading-relaxed">
            Your resume is split into sections, converted to vectors, and stored in a vector database.
            When you ask a question, the most relevant sections are retrieved and sent to the LLM as context —
            so answers are based on your actual resume, not generic advice.
          </p>
        </div>
      </motion.div>
    )
  }

  // ── Chat phase ──
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl">
      {/* Chat header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-sm">AI Career Assistant</h2>
            <p className="text-xs text-gray-500">{resumeFileName || 'Resume loaded'} · RAG-powered</p>
          </div>
        </div>
        <button onClick={handleReset} className="btn-ghost flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-400">
          <RotateCcw className="w-3.5 h-3.5" /> New resume
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} isLatest={i === messages.length - 1} />
        ))}
        {sending && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      <AnimatePresence>
        {showSuggestions && messages.length <= 1 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="pb-3 flex-shrink-0"
          >
            <p className="text-xs text-gray-600 mb-2">Try asking:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.slice(0, 4).map((s, i) => (
                <button key={i} onClick={() => handleSend(s)}
                  className="text-xs px-3 py-1.5 rounded-full bg-surface-300 border border-white/10 text-gray-400 hover:text-white hover:border-brand-600/40 transition-all">
                  {s}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="flex gap-3 pt-3 border-t border-white/5 flex-shrink-0">
        <textarea
          ref={inputRef}
          className="input-field flex-1 resize-none h-12 py-3 leading-normal"
          placeholder="Ask anything about your resume or career..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          rows={1}
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || sending}
          className="btn-primary px-4 h-12 flex items-center justify-center flex-shrink-0"
        >
          {sending
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Send className="w-4 h-4" />
          }
        </button>
      </div>
      <p className="text-xs text-gray-600 text-center mt-2">Enter to send · Shift+Enter for new line</p>
    </div>
  )
}
