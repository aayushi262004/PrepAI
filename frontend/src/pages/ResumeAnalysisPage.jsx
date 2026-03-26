import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileText, CheckCircle, XCircle, Lightbulb, Loader2, RotateCcw, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../utils/api'

function ScoreArc({ score }) {
  const r = 50
  const circ = 2 * Math.PI * r
  const [offset, setOffset] = useState(circ)
  useState(() => { setTimeout(() => setOffset(circ - (score / 100) * circ), 200) })
  // Use imperative effect instead
  const color = score >= 70 ? '#34d399' : score >= 45 ? '#fbbf24' : '#f87171'
  return (
    <svg width="120" height="120" viewBox="0 0 120 120">
      <circle cx="60" cy="60" r={r} fill="none" stroke="#1e1e2a" strokeWidth="10" />
      <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10"
        strokeLinecap="round" strokeDasharray={circ}
        strokeDashoffset={circ - (score / 100) * circ}
        transform="rotate(-90 60 60)"
        style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.34,1.56,0.64,1)' }}
      />
      <text x="60" y="56" textAnchor="middle" fill="white" fontSize="22" fontWeight="700" fontFamily="Syne">{score}</text>
      <text x="60" y="72" textAnchor="middle" fill="#6b7280" fontSize="11" fontFamily="DM Sans">/ 100</text>
    </svg>
  )
}

function FileDropZone({ onFile, file }) {
  const [dragging, setDragging] = useState(false)

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  }

  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 ${
        dragging
          ? 'border-brand-500 bg-brand-600/10'
          : file
          ? 'border-emerald-600/40 bg-emerald-600/5'
          : 'border-white/10 bg-surface-200 hover:border-brand-600/40 hover:bg-brand-600/5'
      }`}
    >
      <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={e => onFile(e.target.files[0])} />
      {file ? (
        <>
          <FileText className="w-8 h-8 text-emerald-400" />
          <p className="text-sm font-medium text-emerald-300">{file.name}</p>
          <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB · Click to change</p>
        </>
      ) : (
        <>
          <Upload className="w-8 h-8 text-gray-500" />
          <div className="text-center">
            <p className="text-sm font-medium text-gray-300">Drop your resume here</p>
            <p className="text-xs text-gray-500 mt-1">PDF or DOCX · Max 5MB</p>
          </div>
        </>
      )}
    </label>
  )
}

export default function ResumeAnalysisPage() {
  const [file, setFile] = useState(null)
  const [jobDescription, setJobDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const handleAnalyze = async (e) => {
    e.preventDefault()
    if (!file) return toast.error('Please upload your resume')
    if (!jobDescription.trim()) return toast.error('Please paste the job description')

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('resume', file)
      formData.append('jobDescription', jobDescription)

      const res = await api.post('/resume/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setResult(res.data)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => { setResult(null); setFile(null); setJobDescription('') }

  if (result) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl">
        <div className="flex items-center justify-between mb-2">
          <h1 className="page-header mb-0">Analysis Complete</h1>
          <button onClick={reset} className="btn-ghost flex items-center gap-2 text-sm">
            <RotateCcw className="w-4 h-4" /> New Analysis
          </button>
        </div>
        <p className="page-subheader">Analyzed: <span className="text-gray-300">{result.fileName}</span></p>

        {/* Score + summary */}
        <div className="glass-card mb-5 flex flex-col sm:flex-row items-center gap-6">
          <ScoreArc score={result.matchScore} />
          <div>
            <p className="text-sm text-gray-500 mb-1">Match Score</p>
            <h2 className="text-2xl font-display font-bold text-white mb-2">
              {result.matchScore >= 70 ? 'Strong Match' : result.matchScore >= 45 ? 'Moderate Match' : 'Needs Work'}
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed">{result.summaryFeedback}</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-5">
          {/* Matched skills */}
          <div className="glass-card">
            <h3 className="section-title flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" /> Matched Skills
              <span className="ml-auto badge-green">{result.matchedSkills.length}</span>
            </h3>
            {result.matchedSkills.length === 0 ? (
              <p className="text-sm text-gray-500">No matched skills found</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {result.matchedSkills.map(s => (
                  <span key={s} className="badge-green capitalize">{s}</span>
                ))}
              </div>
            )}
          </div>

          {/* Missing skills */}
          <div className="glass-card">
            <h3 className="section-title flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-400" /> Missing Skills
              <span className="ml-auto badge-red">{result.missingSkills.length}</span>
            </h3>
            {result.missingSkills.length === 0 ? (
              <p className="text-sm text-gray-500">No missing skills — great job!</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {result.missingSkills.map(s => (
                  <span key={s} className="badge-red capitalize">{s}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Suggestions */}
        {result.suggestions.length > 0 && (
          <div className="glass-card">
            <h3 className="section-title flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-400" /> Improvement Suggestions
            </h3>
            <ul className="space-y-3">
              {result.suggestions.map((s, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-600/20 text-amber-300 text-xs flex items-center justify-center font-medium mt-0.5">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl">
      <h1 className="page-header">Resume Analyzer</h1>
      <p className="page-subheader">Upload your resume and paste the job description to get a detailed skill-gap analysis powered by NLP.</p>

      <form onSubmit={handleAnalyze} className="space-y-5">
        <div>
          <label className="label">Your Resume *</label>
          <FileDropZone file={file} onFile={setFile} />
        </div>

        <div>
          <label className="label">Job Description *</label>
          <textarea
            className="textarea-field h-44"
            placeholder="Paste the full job description here..."
            value={jobDescription}
            onChange={e => setJobDescription(e.target.value)}
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing resume...</>
          ) : (
            <><FileText className="w-4 h-4" /> Analyze Resume</>
          )}
        </button>
      </form>

      {/* How it works */}
      <div className="mt-8 p-4 rounded-xl bg-surface-200 border border-white/5">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">How it works</p>
        <div className="space-y-2">
          {[
            'Your resume text is extracted from the PDF/DOCX',
            'A BERT-based model computes semantic similarity with the job description',
            'Skills are matched and gaps are identified',
            'Actionable suggestions are generated to improve your match rate',
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-gray-400">
              <span className="w-4 h-4 rounded-full bg-brand-600/20 text-brand-400 text-xs flex items-center justify-center flex-shrink-0">{i + 1}</span>
              {step}
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
