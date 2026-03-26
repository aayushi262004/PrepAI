import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Video, VideoOff, Mic, MicOff, Volume2, ChevronRight,
  ChevronLeft, Send, RotateCcw, CheckCircle, Loader2, Plus, X
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../utils/api'

const STEPS = { FORM: 'form', INTERVIEW: 'interview', RESULTS: 'results' }

// ─── Score Ring Component ─────────────────────────────────────────────────────
function ScoreRing({ score }) {
  const r = 54
  const circ = 2 * Math.PI * r
  const [offset, setOffset] = useState(circ)
  useEffect(() => {
    const t = setTimeout(() => setOffset(circ - (score / 100) * circ), 100)
    return () => clearTimeout(t)
  }, [score, circ])
  const color = score >= 70 ? '#34d399' : score >= 45 ? '#fbbf24' : '#f87171'
  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r={r} fill="none" stroke="#1e1e2a" strokeWidth="10" />
      <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="10"
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        transform="rotate(-90 70 70)" className="score-ring" />
      <text x="70" y="67" textAnchor="middle" fill="white" fontSize="26" fontWeight="700" fontFamily="Syne">{score}</text>
      <text x="70" y="85" textAnchor="middle" fill="#6b7280" fontSize="12" fontFamily="DM Sans">/ 100</text>
    </svg>
  )
}

// ─── Camera Preview ───────────────────────────────────────────────────────────
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
    if (!form.jobTitle || !form.jobDescription || !form.yearsOfExperience) return toast.error('Fill all required fields')
    onSubmit(form)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="page-header">AI Mock Interview</h1>
      <p className="page-subheader">Fill in the details and we'll generate 5 personalized interview questions.</p>

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
            <input
              className="input-field flex-1"
              placeholder="e.g. React, TypeScript..."
              value={skillInput}
              onChange={e => setSkillInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSkill())}
            />
            <button type="button" onClick={addSkill} className="btn-secondary px-4">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {form.skills.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {form.skills.map(s => (
                <span key={s} className="badge-blue flex items-center gap-1">
                  {s}
                  <button type="button" onClick={() => removeSkill(s)}><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}
        </div>

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
  const [answer, setAnswer] = useState('')
  const [cameraStream, setCameraStream] = useState(null)
  const [micOn, setMicOn] = useState(false)
  const [camOn, setCamOn] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [results, setResults] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const synthRef = useRef(null)

  // Cleanup on unmount
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
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: micOn })
        setCameraStream(stream)
        setCamOn(true)
      } catch { toast.error('Camera access denied') }
    }
  }
  const fallbackToSpeech = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();

      const utt = new SpeechSynthesisUtterance(text);
      utt.rate = 0.9;

      utt.onstart = () => setSpeaking(true);
      utt.onend = () => setSpeaking(false);

      window.speechSynthesis.speak(utt);
    }
  };


  const speakQuestion = useCallback((text, audioBase64) => {

    // ✅ FIX: Check if audioBase64 is valid
    if (audioBase64 && audioBase64.length > 20) {
      try {
        const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
        setSpeaking(true);

        audio.play().catch(err => {
          console.error("Audio play failed:", err);
          fallbackToSpeech(text);
        });

        audio.onended = () => setSpeaking(false);
        return;

      } catch (err) {
        console.error("Audio creation failed:", err);
      }
    }

    // ✅ fallback always works
    fallbackToSpeech(text);

  }, []);

  const handleGenerate = async (formData) => {
    setLoading(true)
    try {
      const res = await api.post('/interview/generate', formData)
      setSessionId(res.data.sessionId)
      setQuestions(res.data.questions)
      setAnswers(new Array(res.data.questions.length).fill(''))
      setCurrentQ(0)
      setStep(STEPS.INTERVIEW)
      // Auto-play first question
      setTimeout(() => speakQuestion(res.data.questions[0].question, res.data.questions[0].audioBase64), 800)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate questions')
    } finally {
      setLoading(false)
    }
  }

  const handleNext = () => {
    const updatedAnswers = [...answers]
    updatedAnswers[currentQ] = answer
    setAnswers(updatedAnswers)
    if (currentQ < questions.length - 1) {
      const next = currentQ + 1
      setCurrentQ(next)
      setAnswer(updatedAnswers[next] || '')
      setTimeout(() => speakQuestion(questions[next].question, questions[next].audioBase64), 400)
    }
  }

  const handlePrev = () => {
    const updatedAnswers = [...answers]
    updatedAnswers[currentQ] = answer
    setAnswers(updatedAnswers)
    const prev = currentQ - 1
    setCurrentQ(prev)
    setAnswer(updatedAnswers[prev] || '')
  }

  const handleSubmit = async () => {
    const finalAnswers = [...answers]
    finalAnswers[currentQ] = answer
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

  // ── Results view ──
  if (step === STEPS.RESULTS && results) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl">
        <h1 className="page-header">Interview Complete!</h1>
        <p className="page-subheader">Here's how you performed.</p>

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
                  <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div className="glass-card">
            <h3 className="section-title text-amber-400">↑ Improve</h3>
            <ul className="space-y-2">
              {(results.improvements || []).map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                  <ChevronRight className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <button onClick={() => { setStep(STEPS.FORM); setResults(null); setQuestions([]) }} className="btn-secondary flex items-center gap-2">
          <RotateCcw className="w-4 h-4" /> Try Another Interview
        </button>
      </motion.div>
    )
  }

  // ── Interview view ──
  if (step === STEPS.INTERVIEW && questions.length > 0) {
    const q = questions[currentQ]
    const isLast = currentQ === questions.length - 1
    return (
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="page-header mb-0">Mock Interview</h1>
          <div className="flex items-center gap-2">
            {questions.map((_, i) => (
              <div key={i} className={`h-2 rounded-full transition-all duration-300 ${i < currentQ ? 'w-6 bg-brand-500' : i === currentQ ? 'w-6 bg-brand-400' : 'w-2 bg-surface-400'
                }`} />
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Camera + controls */}
          <div className="lg:col-span-2 flex flex-col gap-3">
            <CameraView stream={cameraStream} />
            <div className="flex gap-2">
              <button onClick={toggleCamera} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium border transition-all ${camOn ? 'bg-brand-600/20 border-brand-600/40 text-brand-300' : 'bg-surface-300 border-white/10 text-gray-400 hover:text-white'
                }`}>
                {camOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                {camOn ? 'Camera on' : 'Camera off'}
              </button>
            </div>
          </div>

          {/* Question + answer */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            <div className="glass-card">
              <div className="flex items-start justify-between gap-3 mb-3">
                <span className="badge-blue">Q{currentQ + 1} of {questions.length}</span>
                <span className="badge-amber capitalize">{q.type}</span>
              </div>
              <p className="text-white font-medium leading-relaxed text-lg">{q.question}</p>
              <button
                onClick={() => speakQuestion(q.question, q.audioBase64)}
                disabled={speaking}
                className="mt-3 flex items-center gap-2 text-sm text-brand-400 hover:text-brand-300 transition-colors"
              >
                <Volume2 className={`w-4 h-4 ${speaking ? 'animate-pulse' : ''}`} />
                {speaking ? 'Playing...' : 'Replay question'}
              </button>
            </div>

            <div>
              <label className="label">Your Answer</label>
              <textarea
                className="textarea-field h-40"
                placeholder="Type your answer here, or speak and transcribe..."
                value={answer}
                onChange={e => setAnswer(e.target.value)}
              />
            </div>

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
                <button onClick={handleSubmit} disabled={submitting} className="btn-primary flex items-center gap-2 ml-auto">
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
