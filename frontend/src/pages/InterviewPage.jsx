import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Video, VideoOff, Mic, MicOff, Volume2, ChevronRight,
  ChevronLeft, Send, RotateCcw, CheckCircle, Loader2,
  Plus, X, Circle, Square
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../utils/api'

const STEPS = { FORM: 'form', INTERVIEW: 'interview', RESULTS: 'results' }

// ─── Score Ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score }) {
  const r = 54
  const circ = 2 * Math.PI * r
  const [offset, setOffset] = useState(circ)
  useEffect(() => {
    const t = setTimeout(() => setOffset(circ - (score / 100) * circ), 200)
    return () => clearTimeout(t)
  }, [score, circ])
  const color = score >= 70 ? '#34d399' : score >= 45 ? '#fbbf24' : '#f87171'
  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r={r} fill="none" stroke="#1e1e2a" strokeWidth="10" />
      <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="10"
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        transform="rotate(-90 70 70)"
        style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.34,1.56,0.64,1)' }}
      />
      <text x="70" y="67" textAnchor="middle" fill="white" fontSize="26" fontWeight="700" fontFamily="Syne">{score}</text>
      <text x="70" y="85" textAnchor="middle" fill="#6b7280" fontSize="12" fontFamily="DM Sans">/ 100</text>
    </svg>
  )
}

// ─── Camera View ──────────────────────────────────────────────────────────────
function CameraView({ stream }) {
  const videoRef = useRef(null)
  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream
  }, [stream])
  if (!stream) return (
    <div className="flex-1 bg-surface-300 rounded-xl flex flex-col items-center justify-center gap-2 min-h-[200px]">
      <VideoOff className="w-8 h-8 text-gray-500" />
      <p className="text-xs text-gray-500">Camera off</p>
    </div>
  )
  return <video ref={videoRef} autoPlay muted playsInline className="flex-1 rounded-xl object-cover bg-black min-h-[200px] w-full" />
}

// ─── Speech Recording Hook ────────────────────────────────────────────────────
function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef(null)
  const finalTranscriptRef = useRef('')
  const shouldContinueRef = useRef(false)

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const startListening = useCallback(() => {
    if (!isSupported) {
      toast.error('Speech recognition not supported in this browser. Use Chrome.')
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()

    recognition.continuous = true       // keep listening, don't stop after first pause
    recognition.interimResults = true   // show words as you speak, not just when done
    recognition.lang = 'en-US'

    recognition.onstart = () => {
      setIsListening(true)
      finalTranscriptRef.current = transcript // preserve existing text
    }

    recognition.onresult = (event) => {
      let interimTranscript = ''
      let newFinalTranscript = ''

      // Loop through all results from this session
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          // isFinal = user paused/stopped speaking, this chunk is confirmed
          newFinalTranscript += result[0].transcript + ' '
        } else {
          // interim = still speaking, may change
          interimTranscript += result[0].transcript
        }
      }

      // Update displayed text: confirmed text + live interim preview
      finalTranscriptRef.current += newFinalTranscript
      setTranscript(finalTranscriptRef.current + interimTranscript)
    }

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        shouldContinueRef.current = false
        toast.error('Microphone access denied. Allow mic in browser settings.')
      } else if (event.error === 'no-speech') {
        // User went quiet — not a real error, onend will fire next and restart below
      } else {
        shouldContinueRef.current = false
        toast.error(`Speech error: ${event.error}`)
      }
    }

    recognition.onend = () => {
      // continuous mode still stops on brief silence in some browsers — restart
      // automatically unless the user explicitly clicked Stop
      if (shouldContinueRef.current) {
        recognition.start()
      } else {
        setIsListening(false)
      }
    }

    shouldContinueRef.current = true
    recognitionRef.current = recognition
    recognition.start()
  }, [isSupported, transcript])

  const stopListening = useCallback(() => {
    shouldContinueRef.current = false
    recognitionRef.current?.stop()
    setIsListening(false)
  }, [])

  const resetTranscript = useCallback(() => {
    setTranscript('')
    finalTranscriptRef.current = ''
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldContinueRef.current = false
      recognitionRef.current?.stop()
    }
  }, [])

  return { isListening, transcript, setTranscript, startListening, stopListening, resetTranscript, isSupported }
}

// ─── Form Step ────────────────────────────────────────────────────────────────
function InterviewForm({ onSubmit, loading }) {
  const [form, setForm] = useState({ jobTitle: '', jobDescription: '', yearsOfExperience: '', skills: [] })
  const [skillInput, setSkillInput] = useState('')
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const addSkill = () => {
    const s = skillInput.trim()
    if (s && !form.skills.includes(s)) {
      setForm(f => ({ ...f, skills: [...f.skills, s] }))
      setSkillInput('')
    }
  }
  const removeSkill = (s) => setForm(f => ({ ...f, skills: f.skills.filter(x => x !== s) }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.jobTitle || !form.jobDescription || !form.yearsOfExperience)
      return toast.error('Fill all required fields')
    onSubmit(form)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="page-header">AI Mock Interview</h1>
      <p className="page-subheader">Fill in the details — we'll generate 5 questions, read them aloud, and record your spoken answers.</p>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <label className="label">Job Title *</label>
            <input className="input-field" placeholder="e.g. Senior React Developer" value={form.jobTitle} onChange={set('jobTitle')} />
          </div>
          <div className="sm:col-span-1">
            <label className="label">Years of Experience *</label>
            <input className="input-field" type="number" min="0" max="40" placeholder="e.g. 3" value={form.yearsOfExperience} onChange={set('yearsOfExperience')} />
          </div>
        </div>

        <div>
          <label className="label">Job Description *</label>
          <textarea className="textarea-field h-36" placeholder="Paste the job description here..." value={form.jobDescription} onChange={set('jobDescription')} />
        </div>

        <div>
          <label className="label">Key Skills (optional)</label>
          <div className="flex gap-2 mb-2">
            <input className="input-field flex-1" placeholder="e.g. React, TypeScript..."
              value={skillInput} onChange={e => setSkillInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSkill())} />
            <button type="button" onClick={addSkill} className="btn-secondary px-4"><Plus className="w-4 h-4" /></button>
          </div>
          {form.skills.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {form.skills.map(s => (
                <span key={s} className="badge-blue flex items-center gap-1">
                  {s}<button type="button" onClick={() => removeSkill(s)}><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Browser support warning */}
        {typeof window !== 'undefined' && !('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window) && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-900/20 border border-amber-700/30 text-sm text-amber-300">
            <span>⚠</span> Speech recording works best in Chrome. Other browsers may not support it.
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
          {loading ? 'Generating questions...' : 'Start Interview'}
        </button>
      </form>
    </motion.div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function InterviewPage() {
  const [step, setStep] = useState(STEPS.FORM)
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const [questions, setQuestions] = useState([])
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState([])
  const [cameraStream, setCameraStream] = useState(null)
  const [camOn, setCamOn] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [results, setResults] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const {
    isListening,
    transcript,
    setTranscript,
    startListening,
    stopListening,
    resetTranscript,
    isSupported: speechSupported
  } = useSpeechRecognition()

  // Cleanup camera on unmount
  useEffect(() => () => {
    cameraStream?.getTracks().forEach(t => t.stop())
    window.speechSynthesis?.cancel()
  }, [cameraStream])

  const toggleCamera = async () => {
    if (camOn) {
      cameraStream?.getTracks().forEach(t => t.stop())
      setCameraStream(null)
      setCamOn(false)
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        setCameraStream(stream)
        setCamOn(true)
      } catch { toast.error('Camera access denied') }
    }
  }

  const speakQuestion = useCallback((text, audioBase64) => {
    if (audioBase64) {
      const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`)
      setSpeaking(true)
      audio.play()
      audio.onended = () => setSpeaking(false)
      return
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utt = new SpeechSynthesisUtterance(text)
      utt.rate = 0.9
      utt.onstart = () => setSpeaking(true)
      utt.onend = () => setSpeaking(false)
      window.speechSynthesis.speak(utt)
    }
  }, [])

  const handleGenerate = async (formData) => {
    setLoading(true)
    try {
      const res = await api.post('/interview/generate', formData)
      setSessionId(res.data.sessionId)
      setQuestions(res.data.questions)
      setAnswers(new Array(res.data.questions.length).fill(''))
      setCurrentQ(0)
      setStep(STEPS.INTERVIEW)
      setTimeout(() => speakQuestion(res.data.questions[0].question, res.data.questions[0].audioBase64), 800)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate questions')
    } finally {
      setLoading(false)
    }
  }

  // When moving between questions, save current transcript as answer
  const saveCurrentAnswer = () => {
    const updated = [...answers]
    updated[currentQ] = transcript
    setAnswers(updated)
    return updated
  }

  const handleNext = () => {
    const updated = saveCurrentAnswer()
    const next = currentQ + 1
    setCurrentQ(next)
    // Restore any previously typed/spoken answer for this question
    resetTranscript()
    setTranscript(updated[next] || '')
    if (isListening) stopListening()
    setTimeout(() => speakQuestion(questions[next].question, questions[next].audioBase64), 400)
  }

  const handlePrev = () => {
    const updated = saveCurrentAnswer()
    const prev = currentQ - 1
    setCurrentQ(prev)
    resetTranscript()
    setTranscript(updated[prev] || '')
    if (isListening) stopListening()
  }

  const handleMicToggle = () => {
    if (isListening) {
      stopListening()
    } else {
      // Stop TTS if it's speaking
      window.speechSynthesis?.cancel()
      setSpeaking(false)
      startListening()
    }
  }

  const handleSubmit = async () => {
    if (isListening) stopListening()
    const finalAnswers = saveCurrentAnswer()
    setSubmitting(true)
    try {
      const res = await api.post(`/interview/${sessionId}/submit`, {
        answers: finalAnswers.map((a, i) => ({ questionId: i, answer: a }))
      })
      setResults(res.data.feedback)
      setStep(STEPS.RESULTS)
    } catch (err) {
      toast.error('Failed to submit interview')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Results ──
  if (step === STEPS.RESULTS && results) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl">
        <h1 className="page-header">Interview Complete!</h1>
        <p className="page-subheader">Here's your performance breakdown.</p>

        <div className="glass-card mb-6 flex flex-col items-center py-8">
          <ScoreRing score={results.score || 0} />
          <p className="text-gray-400 mt-4 text-sm">Overall Score</p>
          <p className="text-white text-center mt-4 max-w-sm leading-relaxed">{results.summary}</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div className="glass-card">
            <h3 className="section-title text-emerald-400">✓ Strengths</h3>
            <ul className="space-y-2">
              {(results.strengths || []).map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                  <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />{s}
                </li>
              ))}
            </ul>
          </div>
          <div className="glass-card">
            <h3 className="section-title text-amber-400">↑ Improve</h3>
            <ul className="space-y-2">
              {(results.improvements || []).map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                  <ChevronRight className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />{s}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <button onClick={() => { setStep(STEPS.FORM); setResults(null); setQuestions([]) }}
          className="btn-secondary flex items-center gap-2">
          <RotateCcw className="w-4 h-4" /> Try Another Interview
        </button>
      </motion.div>
    )
  }

  // ── Interview ──
  if (step === STEPS.INTERVIEW && questions.length > 0) {
    const q = questions[currentQ]
    const isLast = currentQ === questions.length - 1
    const answerLength = transcript.trim().split(/\s+/).filter(Boolean).length

    return (
      <div className="max-w-4xl">
        {/* Header + progress */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="page-header mb-0">Mock Interview</h1>
          <div className="flex items-center gap-1.5">
            {questions.map((_, i) => (
              <div key={i} className={`rounded-full transition-all duration-300 ${i < currentQ ? 'w-6 h-2 bg-brand-500' :
                  i === currentQ ? 'w-6 h-2 bg-brand-400' : 'w-2 h-2 bg-surface-400'
                }`} />
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Left: camera + controls */}
          <div className="lg:col-span-2 flex flex-col gap-3">
            <CameraView stream={cameraStream} />

            <div className="grid grid-cols-2 gap-2">
              {/* Camera toggle */}
              <button onClick={toggleCamera}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-all ${camOn ? 'bg-brand-600/20 border-brand-600/40 text-brand-300' : 'bg-surface-300 border-white/10 text-gray-400 hover:text-white'
                  }`}>
                {camOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                {camOn ? 'Camera' : 'Camera'}
              </button>

              {/* Mic / Speech toggle */}
              <button onClick={handleMicToggle}
                disabled={!speechSupported}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-all ${isListening
                    ? 'bg-red-600/20 border-red-600/40 text-red-300 animate-pulse'
                    : speechSupported
                      ? 'bg-surface-300 border-white/10 text-gray-400 hover:text-white hover:border-brand-600/40'
                      : 'bg-surface-300 border-white/10 text-gray-600 cursor-not-allowed'
                  }`}>
                {isListening ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                {isListening ? 'Stop' : 'Speak'}
              </button>
            </div>

            {/* Live status indicators */}
            <div className="space-y-1.5">
              {isListening && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-600/10 border border-red-600/20">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs text-red-300 font-medium">Recording — speak your answer</span>
                </div>
              )}
              {speaking && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-600/10 border border-brand-600/20">
                  <div className="flex gap-0.5">
                    {[0, 0.15, 0.3].map((d, i) => (
                      <motion.div key={i} className="w-1 bg-brand-400 rounded-full"
                        animate={{ height: [4, 12, 4] }}
                        transition={{ duration: 0.6, delay: d, repeat: Infinity }} />
                    ))}
                  </div>
                  <span className="text-xs text-brand-300 font-medium">Playing question...</span>
                </div>
              )}
              {!speechSupported && (
                <p className="text-xs text-gray-500 text-center">Use Chrome for speech recording</p>
              )}
            </div>
          </div>

          {/* Right: question + answer */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            {/* Question card */}
            <div className="glass-card">
              <div className="flex items-start justify-between gap-3 mb-3">
                <span className="badge-blue">Q{currentQ + 1} of {questions.length}</span>
                <span className="badge-amber capitalize">{q.type}</span>
              </div>
              <p className="text-white font-medium leading-relaxed text-lg">{q.question}</p>
              <button onClick={() => speakQuestion(q.question, q.audioBase64)} disabled={speaking}
                className="mt-3 flex items-center gap-2 text-sm text-brand-400 hover:text-brand-300 transition-colors">
                <Volume2 className={`w-4 h-4 ${speaking ? 'animate-pulse' : ''}`} />
                {speaking ? 'Playing...' : 'Replay question'}
              </button>
            </div>

            {/* Answer area */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0">Your Answer</label>
                <div className="flex items-center gap-3">
                  {/* Word count */}
                  <span className={`text-xs ${answerLength > 20 ? 'text-emerald-400' : 'text-gray-500'}`}>
                    {answerLength} words {answerLength > 20 ? '✓' : '(aim for 50+)'}
                  </span>
                  {/* Clear button */}
                  {transcript && (
                    <button onClick={() => { resetTranscript(); setTranscript('') }}
                      className="text-xs text-gray-500 hover:text-red-400 transition-colors">
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <textarea
                className={`textarea-field h-44 transition-all ${isListening ? 'border-red-500/50 ring-1 ring-red-500/20' : ''
                  }`}
                placeholder={
                  speechSupported
                    ? 'Click "Speak" to record your answer, or type here...'
                    : 'Type your answer here...'
                }
                value={transcript}
                onChange={e => setTranscript(e.target.value)}
              />
              {/* Tip */}
              {speechSupported && !isListening && !transcript && (
                <p className="text-xs text-gray-600 mt-1.5">
                  💡 Click <span className="text-gray-400">Speak</span> → talk naturally → click <span className="text-gray-400">Stop</span>. Your words appear in real time.
                </p>
              )}
            </div>

            {/* Navigation */}
            <div className="flex gap-3">
              {currentQ > 0 && (
                <button onClick={handlePrev} className="btn-secondary flex items-center gap-2">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
              )}
              {!isLast ? (
                <button onClick={handleNext} className="btn-primary flex items-center gap-2 ml-auto">
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button onClick={handleSubmit} disabled={submitting}
                  className="btn-primary flex items-center gap-2 ml-auto">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {submitting ? 'Submitting...' : 'Submit Interview'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return <InterviewForm onSubmit={handleGenerate} loading={loading} />
}