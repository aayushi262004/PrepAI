import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Video, FileText, ArrowRight, Zap, Target } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const FEATURES = [
  {
    to: '/interview',
    icon: Video,
    color: 'from-violet-500 to-indigo-600',
    glow: 'shadow-violet-900/40',
    badge: 'Feature 1',
    title: 'AI Mock Interview',
    description: 'Get 5 tailored interview questions based on your job description. Hear them spoken aloud and practice your answers on camera.',
    points: ['Groq LLM question generation', 'Text-to-speech playback', 'Camera + mic recording', 'AI feedback & scoring'],
    stat: { icon: Zap, label: '5 questions' },
  },
  {
    to: '/resume',
    icon: FileText,
    color: 'from-emerald-500 to-teal-600',
    glow: 'shadow-emerald-900/40',
    badge: 'Feature 2',
    title: 'Resume Analyzer',
    description: 'Upload your resume — optionally with a job description — and get an AI-scored ATS report: skill gaps, missing keywords, formatting issues, and actionable recommendations, all in one pass.',
    points: ['ATS compatibility score (0-100)', 'Matched vs missing keywords', 'Formatting & structure check', 'Improvement recommendations'],
    stat: { icon: Target, label: '0–100 score' },
  },
]

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.12, duration: 0.5, ease: [0.22, 1, 0.36, 1] } }),
}

export default function HomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
        <p className="text-ink-faint text-sm font-medium mb-1">{greeting},</p>
        <h1 className="text-4xl font-display font-bold text-ink">
          {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-ink-muted mt-2 max-w-lg">
          Ready to level up your career? Pick a tool below and let AI help you land your next role.
        </p>
      </motion.div>

      {/* Feature cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.to}
            custom={i}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            onClick={() => navigate(f.to)}
            className="glass-card cursor-pointer group relative overflow-hidden"
          >
            {/* Gradient top bar */}
            <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${f.color}`} />

            {/* Icon */}
            <div className={`inline-flex w-12 h-12 rounded-2xl bg-gradient-to-br ${f.color} items-center justify-center mb-4 shadow-lg ${f.glow}`}>
              <f.icon className="w-6 h-6 text-white" />
            </div>

            {/* Badge + Title */}
            <div className="flex items-center gap-2 mb-1">
              <span className="badge-blue text-xs">{f.badge}</span>
            </div>
            <h2 className="text-xl font-display font-bold text-ink mb-2">{f.title}</h2>
            <p className="text-ink-muted text-sm leading-relaxed mb-4">{f.description}</p>

            {/* Points */}
            <ul className="space-y-1.5 mb-5">
              {f.points.map(p => (
                <li key={p} className="flex items-center gap-2 text-xs text-ink-muted">
                  <div className="w-1 h-1 rounded-full bg-brand-500 flex-shrink-0" />
                  {p}
                </li>
              ))}
            </ul>

            {/* CTA */}
            <div className="flex items-center justify-between mt-auto pt-4 border-t border-line">
              <div className="flex items-center gap-1.5 text-xs text-ink-faint">
                <f.stat.icon className="w-3.5 h-3.5" />
                {f.stat.label}
              </div>
              <span className="flex items-center gap-1 text-sm font-medium text-brand-400 group-hover:text-brand-300 transition-colors">
                Start <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tip banner */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-8 flex items-start gap-3 p-4 rounded-xl bg-brand-600/10 border border-brand-600/20"
      >
        <div className="w-6 h-6 rounded-full bg-brand-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Zap className="w-3.5 h-3.5 text-brand-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-brand-300">Pro tip</p>
          <p className="text-sm text-ink-muted mt-0.5">
            Start with the Resume Analyzer to check your ATS score and fix skill gaps, then practice with a Mock Interview.
          </p>
        </div>
      </motion.div>
    </div>
  )
}
