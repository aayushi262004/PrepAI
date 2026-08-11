import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Video, FileText, Sparkles, ArrowRight, Zap, Target, LogIn } from 'lucide-react'
import AuthPromptModal from '../components/AuthPromptModal'
import ThemeToggle from '../components/ThemeToggle'

const FEATURES = [
  {
    icon: Video,
    tag: 'Feature 1',
    title: 'AI Mock Interview',
    tagline: 'Practice out loud, get scored.',
    description: 'Get 5 tailored interview questions based on your job description. Hear them spoken aloud and practice your answers on camera.',
    points: ['Groq LLM question generation', 'Text-to-speech playback', 'Camera + mic recording', 'AI feedback & scoring'],
    stat: { icon: Zap, label: '5 questions' },
  },
  {
    icon: FileText,
    tag: 'Feature 2',
    title: 'Resume Analyzer',
    tagline: 'ATS scoring in one pass.',
    description: 'Upload your resume — optionally with a job description — and get an AI-scored ATS report: skill gaps, missing keywords, formatting issues, and actionable recommendations.',
    points: ['ATS compatibility score (0-100)', 'Matched vs missing keywords', 'Formatting & structure check', 'Improvement recommendations'],
    stat: { icon: Target, label: '0-100 score' },
  },
  {
    icon: Sparkles,
    tag: 'Feature 3',
    title: 'Career Assistant',
    tagline: 'Chats that know your resume.',
    description: "A RAG-powered assistant that has actually read your resume. Ask about your fit for a role, skill gaps, or how to rewrite a bullet point, and get answers grounded in your real experience — not generic advice.",
    points: ['Upload once, ask anything', 'Retrieval-grounded answers', 'Rewrite bullets, check fit', 'Multi-turn conversation'],
    stat: { icon: Sparkles, label: 'RAG-powered' },
  },
]

const logoMark = (
  <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
    <circle cx="24" cy="16" r="8" fill="white" opacity="0.9" />
    <path d="M8 40c0-8.837 7.163-16 16-16s16 7.163 16 16" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
  </svg>
)

export default function LandingPage() {
  const navigate = useNavigate()
  const [activeIdx, setActiveIdx] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const active = FEATURES[activeIdx]

  const goAuth = (tab) => navigate('/auth', { state: { tab } })

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 lg:px-10 py-5 border-b border-line">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0">
            {logoMark}
          </div>
          <span className="font-display font-bold text-ink text-lg">PrepAI</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button onClick={() => goAuth('login')} className="btn-ghost text-sm">Log In</button>
          <button onClick={() => goAuth('signup')} className="btn-primary text-sm py-2 px-5">Get Started</button>
        </div>
      </header>

      {/* Hero */}
      <div className="px-6 lg:px-10 pt-12 pb-8 max-w-2xl">
        <h1 className="text-4xl lg:text-5xl font-display font-bold text-ink tracking-tight leading-[1.1]">
          Everything you need to <span className="text-brand-400">land the role.</span>
        </h1>
        <p className="mt-4 text-ink-muted text-lg leading-relaxed">
          Three tools in one: practice interviews out loud, get your resume scored like a recruiter would,
          and ask a chatbot that's actually read your resume. Pick one below to see how it works.
        </p>
      </div>

      {/* Mobile: horizontal chip row */}
      <div className="flex lg:hidden gap-2 overflow-x-auto px-6 pb-4 -mt-2">
        {FEATURES.map((f, i) => (
          <button
            key={f.title}
            onClick={() => setActiveIdx(i)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
              i === activeIdx
                ? 'bg-brand-600/20 text-brand-300 border border-brand-600/30'
                : 'bg-surface-200 text-ink-muted border border-line'
            }`}
          >
            <f.icon className="w-4 h-4" />
            {f.title}
          </button>
        ))}
      </div>

      {/* Body: sidebar + detail panel */}
      <div className="flex-1 flex flex-col lg:flex-row px-6 lg:px-10 pb-12 gap-6 lg:gap-8">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col w-64 flex-shrink-0">
          <p className="text-xs font-medium text-ink-faint uppercase tracking-wider px-3 mb-2">Features</p>
          <div className="flex flex-col gap-1">
            {FEATURES.map((f, i) => (
              <button
                key={f.title}
                onClick={() => setActiveIdx(i)}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all duration-200 ${
                  i === activeIdx
                    ? 'bg-brand-600/20 border border-brand-600/30'
                    : 'border border-transparent hover:bg-surface-200'
                }`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border ${
                  i === activeIdx ? 'bg-surface-300 border-brand-600/40' : 'bg-surface-200 border-line-strong'
                }`}>
                  <f.icon className={`w-4 h-4 ${i === activeIdx ? 'text-brand-400' : 'text-ink-muted'}`} />
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-medium truncate ${i === activeIdx ? 'text-ink' : 'text-ink-muted'}`}>{f.title}</p>
                  <p className="text-xs text-ink-faint truncate">{f.tagline}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-line">
            <button
              onClick={() => goAuth('login')}
              className="flex items-center gap-2 text-sm text-ink-faint hover:text-ink transition-colors px-3 py-2"
            >
              <LogIn className="w-4 h-4" />
              Already have an account?
            </button>
          </div>
        </aside>

        {/* Detail panel */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active.title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="glass-card flex-1 max-w-2xl flex flex-col"
          >
            <div className="w-11 h-11 rounded-xl bg-surface-300 border border-line-strong flex items-center justify-center mb-4">
              <active.icon className="w-5 h-5 text-brand-400" />
            </div>

            <p className="text-xs font-medium text-ink-faint uppercase tracking-wider mb-1.5">{active.tag}</p>
            <h2 className="text-2xl font-display font-bold text-ink mb-2">{active.title}</h2>
            <p className="text-ink-muted leading-relaxed mb-5">{active.description}</p>

            <ul className="space-y-2 mb-6">
              {active.points.map(p => (
                <li key={p} className="flex items-center gap-2.5 text-sm text-ink-muted">
                  <div className="w-1 h-1 rounded-full bg-brand-500 flex-shrink-0" />
                  {p}
                </li>
              ))}
            </ul>

            <div className="mt-auto flex items-center justify-between pt-5 border-t border-line">
              <div className="flex items-center gap-1.5 text-xs text-ink-faint">
                <active.stat.icon className="w-3.5 h-3.5" />
                {active.stat.label}
              </div>
              <button
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-1 text-sm font-medium text-brand-400 hover:text-brand-300 transition-colors group"
              >
                Try {active.title} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <AuthPromptModal
        open={modalOpen}
        featureName={active.title}
        onClose={() => setModalOpen(false)}
        onLogin={() => goAuth('login')}
        onGetStarted={() => goAuth('signup')}
      />
    </div>
  )
}
