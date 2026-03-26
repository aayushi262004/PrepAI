import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Video, FileText, BarChart3, ArrowRight, Zap, Target, TrendingUp } from 'lucide-react'
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
    description: 'Upload your resume and paste a job description. Get a semantic skill-gap analysis with actionable improvement suggestions.',
    points: ['Semantic similarity (BERT)', 'Matched vs missing skills', 'Improvement suggestions', 'PDF & DOCX support'],
    stat: { icon: Target, label: 'Skill gap analysis' },
  },
  {
    to: '/ats',
    icon: BarChart3,
    color: 'from-amber-500 to-orange-600',
    glow: 'shadow-amber-900/40',
    badge: 'Feature 3',
    title: 'ATS Score',
    description: 'Find out if your resume will pass automated screening systems. Get a score, identify missing keywords, and fix formatting issues.',
    points: ['ATS compatibility score', 'Keyword matching', 'Section structure check', 'Formatting recommendations'],
    stat: { icon: TrendingUp, label: '0–100 score' },
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
        <p className="text-gray-500 text-sm font-medium mb-1">{greeting},</p>
        <h1 className="text-4xl font-display font-bold text-white">
          {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-gray-400 mt-2 max-w-lg">
          Ready to level up your career? Pick a tool below and let AI help you land your next role.
        </p>
      </motion.div>

      {/* Feature cards */}
      <div className="grid gap-6 lg:grid-cols-3">
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
            <h2 className="text-xl font-display font-bold text-white mb-2">{f.title}</h2>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">{f.description}</p>

            {/* Points */}
            <ul className="space-y-1.5 mb-5">
              {f.points.map(p => (
                <li key={p} className="flex items-center gap-2 text-xs text-gray-400">
                  <div className="w-1 h-1 rounded-full bg-brand-500 flex-shrink-0" />
                  {p}
                </li>
              ))}
            </ul>

            {/* CTA */}
            <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
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
          <p className="text-sm text-gray-400 mt-0.5">
            Start with the ATS Score to check your current resume, then use the Resume Analyzer to fix skill gaps, and finally practice with Mock Interviews.
          </p>
        </div>
      </motion.div>
    </div>
  )
}
