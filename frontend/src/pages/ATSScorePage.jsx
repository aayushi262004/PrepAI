import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Upload, FileText, BarChart3, CheckCircle, XCircle, AlertTriangle, Loader2, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../utils/api'

function ATSScoreGauge({ score }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    let current = 0
    const step = score / 60
    const timer = setInterval(() => {
      current = Math.min(current + step, score)
      setDisplay(Math.round(current))
      if (current >= score) clearInterval(timer)
    }, 16)
    return () => clearInterval(timer)
  }, [score])

  const color = score >= 70 ? 'text-emerald-400' : score >= 45 ? 'text-amber-400' : 'text-red-400'
  const bg = score >= 70 ? 'from-emerald-500/20 to-emerald-600/5' : score >= 45 ? 'from-amber-500/20 to-amber-600/5' : 'from-red-500/20 to-red-600/5'
  const label = score >= 70 ? 'ATS Friendly' : score >= 45 ? 'Needs Improvement' : 'Not ATS Ready'

  return (
    <div className={`glass-card bg-gradient-to-br ${bg} flex flex-col items-center py-8 mb-6`}>
      <div className={`text-7xl font-display font-bold ${color} tabular-nums`}>{display}</div>
      <div className="text-gray-500 text-lg mt-1">/ 100</div>
      <div className={`mt-3 badge text-sm px-4 py-1 ${
        score >= 70 ? 'badge-green' : score >= 45 ? 'badge-amber' : 'badge-red'
      }`}>
        {label}
      </div>
      {/* Score bar */}
      <div className="w-full max-w-xs mt-5 bg-surface-300 rounded-full h-2">
        <motion.div
          className={`h-2 rounded-full ${score >= 70 ? 'bg-emerald-500' : score >= 45 ? 'bg-amber-500' : 'bg-red-500'}`}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1.2, ease: [0.34, 1.56, 0.64, 1] }}
        />
      </div>
    </div>
  )
}

function SectionBadge({ label, present }) {
  return (
    <div className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm ${
      present
        ? 'bg-emerald-600/10 border-emerald-600/20 text-emerald-300'
        : 'bg-red-600/10 border-red-600/20 text-red-300'
    }`}>
      {present ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
      {label}
    </div>
  )
}

function FileDropZone({ onFile, file }) {
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
      className={`flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 ${
        dragging ? 'border-brand-500 bg-brand-600/10' :
        file ? 'border-amber-600/40 bg-amber-600/5' :
        'border-white/10 bg-surface-200 hover:border-brand-600/40 hover:bg-brand-600/5'
      }`}
    >
      <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={e => onFile(e.target.files[0])} />
      {file ? (
        <>
          <FileText className="w-8 h-8 text-amber-400" />
          <p className="text-sm font-medium text-amber-300">{file.name}</p>
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

const SECTION_LABELS = {
  hasContactInfo: 'Contact Info',
  hasSummary: 'Summary / Objective',
  hasExperience: 'Work Experience',
  hasEducation: 'Education',
  hasSkills: 'Skills Section',
  hasProjects: 'Projects',
}

export default function ATSScorePage() {
  const [file, setFile] = useState(null)
  const [jobDescription, setJobDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const handleScore = async (e) => {
    e.preventDefault()
    if (!file) return toast.error('Please upload your resume')
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('resume', file)
      if (jobDescription.trim()) formData.append('jobDescription', jobDescription)
      const res = await api.post('/ats/score', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setResult(res.data)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Scoring failed')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => { setResult(null); setFile(null); setJobDescription('') }

  if (result) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl">
        <div className="flex items-center justify-between mb-2">
          <h1 className="page-header mb-0">ATS Report</h1>
          <button onClick={reset} className="btn-ghost flex items-center gap-2 text-sm">
            <RotateCcw className="w-4 h-4" /> Check Another
          </button>
        </div>
        <p className="page-subheader">File: <span className="text-gray-300">{result.fileName}</span></p>

        <ATSScoreGauge score={result.atsScore} />

        {/* Sections check */}
        <div className="glass-card mb-5">
          <h3 className="section-title">Resume Sections</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(result.sectionPresence || {}).map(([key, present]) => (
              <SectionBadge key={key} label={SECTION_LABELS[key] || key} present={present} />
            ))}
          </div>
        </div>

        {/* Keywords */}
        {(result.keywordsFound?.length > 0 || result.keywordsMissing?.length > 0) && (
          <div className="grid sm:grid-cols-2 gap-4 mb-5">
            {result.keywordsFound?.length > 0 && (
              <div className="glass-card">
                <h3 className="section-title flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" /> Keywords Found
                  <span className="ml-auto badge-green">{result.keywordsFound.length}</span>
                </h3>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {result.keywordsFound.map(k => (
                    <span key={k} className="badge-green text-xs">{k}</span>
                  ))}
                </div>
              </div>
            )}
            {result.keywordsMissing?.length > 0 && (
              <div className="glass-card">
                <h3 className="section-title flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-400" /> Keywords Missing
                  <span className="ml-auto badge-red">{result.keywordsMissing.length}</span>
                </h3>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {result.keywordsMissing.slice(0, 20).map(k => (
                    <span key={k} className="badge-red text-xs">{k}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recommendations */}
        {result.recommendations?.length > 0 && (
          <div className="glass-card">
            <h3 className="section-title flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" /> Recommendations
            </h3>
            <ul className="space-y-3">
              {result.recommendations.map((r, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-600/20 text-amber-300 text-xs flex items-center justify-center font-medium mt-0.5">{i + 1}</span>
                  {r}
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
      <h1 className="page-header">ATS Score</h1>
      <p className="page-subheader">Check if your resume will pass Applicant Tracking Systems used by most companies.</p>

      <form onSubmit={handleScore} className="space-y-5">
        <div>
          <label className="label">Your Resume *</label>
          <FileDropZone file={file} onFile={setFile} />
        </div>

        <div>
          <label className="label">Job Description <span className="text-gray-600">(optional — improves keyword analysis)</span></label>
          <textarea
            className="textarea-field h-32"
            placeholder="Paste the job description for targeted keyword analysis..."
            value={jobDescription}
            onChange={e => setJobDescription(e.target.value)}
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Scoring resume...</>
          ) : (
            <><BarChart3 className="w-4 h-4" /> Get ATS Score</>
          )}
        </button>
      </form>

      {/* Score breakdown preview */}
      <div className="mt-8 p-4 rounded-xl bg-surface-200 border border-white/5">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Score Breakdown</p>
        <div className="space-y-2">
          {[
            { label: 'Resume sections present', points: '25 pts' },
            { label: 'Keyword match with job description', points: '35 pts' },
            { label: 'Action verbs / power words', points: '20 pts' },
            { label: 'Quantified achievements', points: '10 pts' },
            { label: 'Resume length (300–700 words)', points: '10 pts' },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between text-xs text-gray-400">
              <span>{item.label}</span>
              <span className="badge-blue">{item.points}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
