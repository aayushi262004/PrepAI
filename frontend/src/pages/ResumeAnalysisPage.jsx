import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Upload, FileText, BarChart3, CheckCircle, XCircle, Lightbulb, Loader2, RotateCcw, Star, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../utils/api'

function ScoreGauge({ score }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    let cur = 0; const step = score / 60
    const t = setInterval(() => { cur = Math.min(cur + step, score); setDisplay(Math.round(cur)); if (cur >= score) clearInterval(t) }, 16)
    return () => clearInterval(t)
  }, [score])
  const color = score >= 70 ? 'text-emerald-400' : score >= 45 ? 'text-amber-400' : 'text-red-400'
  const barColor = score >= 70 ? 'bg-emerald-500' : score >= 45 ? 'bg-amber-500' : 'bg-red-500'
  const label = score >= 70 ? 'Strong Resume' : score >= 45 ? 'Needs Improvement' : 'Needs Work'
  return (
    <div className="flex flex-col items-center py-6">
      <div className={`text-8xl font-display font-bold ${color} tabular-nums`}>{display}</div>
      <div className="text-gray-500 text-xl mt-1">/ 100</div>
      <div className={`mt-3 px-4 py-1 rounded-full text-sm font-medium ${score >= 70 ? 'bg-emerald-900/40 text-emerald-300' : score >= 45 ? 'bg-amber-900/40 text-amber-300' : 'bg-red-900/40 text-red-300'}`}>{label}</div>
      <div className="w-64 mt-5 bg-surface-300 rounded-full h-2">
        <motion.div className={`h-2 rounded-full ${barColor}`} initial={{ width: 0 }} animate={{ width: `${score}%` }} transition={{ duration: 1.2, ease: [0.34, 1.56, 0.64, 1] }} />
      </div>
    </div>
  )
}

function SemanticMatchCard({ score }) {
  const color = score >= 70 ? 'text-emerald-400' : score >= 45 ? 'text-amber-400' : 'text-red-400'
  const barColor = score >= 70 ? 'bg-emerald-500' : score >= 45 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="glass-card mb-5">
      <h3 className="section-title flex items-center gap-2"><TrendingUp className="w-4 h-4 text-brand-400" /> Semantic Match Score</h3>
      <div className="flex items-center gap-5">
        <div className={`text-4xl font-display font-bold ${color} tabular-nums flex-shrink-0`}>{score}<span className="text-lg text-gray-500">/100</span></div>
        <div className="flex-1">
          <div className="h-2 bg-surface-300 rounded-full overflow-hidden mb-2">
            <motion.div className={`h-full rounded-full ${barColor}`} initial={{ width: 0 }} animate={{ width: `${score}%` }} transition={{ duration: 1, ease: 'easeOut' }} />
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            Computed independently from the AI score above — embedding similarity between your resume and the job description, not an LLM judgment.
          </p>
        </div>
      </div>
    </div>
  )
}

function SectionBar({ label, score, max, color }) {
  const pct = Math.round((score / max) * 100)
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-300">{label}</span>
        <span className="text-gray-400 font-mono">{score}/{max}</span>
      </div>
      <div className="h-2 bg-surface-300 rounded-full overflow-hidden">
        <motion.div className={`h-full rounded-full ${color}`} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: 'easeOut' }} />
      </div>
    </div>
  )
}

function FileDropZone({ onFile, file }) {
  const [dragging, setDragging] = useState(false)
  const handleDrop = (e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) onFile(f) }
  return (
    <label onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={handleDrop}
      className={`flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all ${dragging ? 'border-brand-500 bg-brand-600/10' : file ? 'border-emerald-600/40 bg-emerald-600/5' : 'border-white/10 bg-surface-200 hover:border-brand-600/40'}`}>
      <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={e => onFile(e.target.files[0])} />
      {file ? (<><FileText className="w-8 h-8 text-emerald-400" /><p className="text-sm font-medium text-emerald-300">{file.name}</p><p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB · Click to change</p></>) : (<><Upload className="w-8 h-8 text-gray-500" /><p className="text-sm font-medium text-gray-300">Drop your resume here</p><p className="text-xs text-gray-500 mt-1">PDF or DOCX · Max 5MB</p></>)}
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

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('resume', file)
      if (jobDescription.trim()) formData.append('jobDescription', jobDescription)

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
    const ss = result.sectionScores || {}
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl">
        <div className="flex items-center justify-between mb-2">
          <h1 className="page-header mb-0">Resume Report</h1>
          <button onClick={reset} className="btn-ghost flex items-center gap-2 text-sm">
            <RotateCcw className="w-4 h-4" /> New Analysis
          </button>
        </div>
        <p className="page-subheader">Analyzed: <span className="text-gray-300">{result.fileName}</span></p>

        {/* Score */}
        <div className="glass-card mb-5">
          <ScoreGauge score={result.score} />
          {result.summary && <p className="text-center text-gray-400 text-sm mt-2 max-w-lg mx-auto leading-relaxed">{result.summary}</p>}
        </div>

        {/* Semantic match — ML-computed via embeddings, independent of the AI score above */}
        {result.semanticMatchScore != null && <SemanticMatchCard score={result.semanticMatchScore} />}

        {/* Section breakdown */}
        {ss.skills_match !== undefined && (
          <div className="glass-card mb-5">
            <h3 className="section-title flex items-center gap-2"><BarChart3 className="w-4 h-4 text-brand-400" /> Score Breakdown</h3>
            <div className="space-y-3">
              <SectionBar label="Skills match" score={ss.skills_match} max={30} color="bg-brand-500" />
              <SectionBar label="Experience relevance" score={ss.experience_relevance} max={25} color="bg-violet-500" />
              <SectionBar label="Education fit" score={ss.education_fit} max={15} color="bg-teal-500" />
              <SectionBar label="Keywords" score={ss.keywords} max={20} color="bg-amber-500" />
              <SectionBar label="Formatting" score={ss.formatting} max={10} color="bg-emerald-500" />
            </div>
          </div>
        )}

        {/* Strengths */}
        {result.strengths?.length > 0 && (
          <div className="glass-card mb-5">
            <h3 className="section-title flex items-center gap-2"><Star className="w-4 h-4 text-emerald-400" /> Strengths</h3>
            <ul className="space-y-2">{result.strengths.map((s, i) => <li key={i} className="flex items-start gap-2 text-sm text-gray-300"><CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />{s}</li>)}</ul>
          </div>
        )}

        {/* Matched / missing keywords */}
        {(result.matchedKeywords?.length > 0 || result.missingKeywords?.length > 0) && (
          <div className="grid sm:grid-cols-2 gap-4 mb-5">
            {result.matchedKeywords?.length > 0 && (
              <div className="glass-card">
                <h3 className="section-title flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-400" /> Matched <span className="ml-auto text-xs bg-emerald-900/40 text-emerald-300 px-2 py-0.5 rounded-full">{result.matchedKeywords.length}</span></h3>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">{result.matchedKeywords.map(k => <span key={k} className="badge-green text-xs capitalize">{k}</span>)}</div>
              </div>
            )}
            {result.missingKeywords?.length > 0 && (
              <div className="glass-card">
                <h3 className="section-title flex items-center gap-2"><XCircle className="w-4 h-4 text-red-400" /> Missing <span className="ml-auto text-xs bg-red-900/40 text-red-300 px-2 py-0.5 rounded-full">{result.missingKeywords.length}</span></h3>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">{result.missingKeywords.map(k => <span key={k} className="badge-red text-xs capitalize">{k}</span>)}</div>
              </div>
            )}
          </div>
        )}

        {/* Experience gap / tone feedback — only meaningful when a JD was given */}
        {(result.experienceGap || result.toneFeedback) && (
          <div className="grid sm:grid-cols-2 gap-4 mb-5">
            {result.experienceGap && (
              <div className="glass-card">
                <h3 className="section-title">Experience Gap</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{result.experienceGap}</p>
              </div>
            )}
            {result.toneFeedback && (
              <div className="glass-card">
                <h3 className="section-title">Tone & Writing</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{result.toneFeedback}</p>
              </div>
            )}
          </div>
        )}

        {/* Recommendations */}
        {result.recommendations?.length > 0 && (
          <div className="glass-card">
            <h3 className="section-title flex items-center gap-2"><Lightbulb className="w-4 h-4 text-amber-400" /> Recommendations</h3>
            <ul className="space-y-3">{result.recommendations.map((r, i) => <li key={i} className="flex items-start gap-3 text-sm text-gray-300"><span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-600/20 text-amber-300 text-xs flex items-center justify-center font-medium mt-0.5">{i + 1}</span>{r}</li>)}</ul>
          </div>
        )}
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl">
      <h1 className="page-header">Resume Analyzer</h1>
      <p className="page-subheader">Upload your resume to get an AI-scored ATS report — skill matching, keyword gaps, formatting issues, and actionable recommendations, all in one pass.</p>

      <form onSubmit={handleAnalyze} className="space-y-5">
        <div>
          <label className="label">Your Resume *</label>
          <FileDropZone file={file} onFile={setFile} />
        </div>

        <div>
          <label className="label">Job Description <span className="text-gray-600">(optional — recommended for skill-gap accuracy)</span></label>
          <textarea
            className="textarea-field h-36"
            placeholder="Paste the job description here for a targeted match score..."
            value={jobDescription}
            onChange={e => setJobDescription(e.target.value)}
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> AI is analyzing your resume...</>
          ) : (
            <><BarChart3 className="w-4 h-4" /> Analyze Resume</>
          )}
        </button>
      </form>

      {/* How it works */}
      <div className="mt-8 p-4 rounded-xl bg-surface-200 border border-white/5">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">How it works</p>
        <div className="space-y-2">
          {[
            'Your resume text is extracted from the PDF/DOCX',
            'Scored like a real recruiter across 5 dimensions (skills, experience, education, keywords, formatting)',
            'If you add a job description, skill gaps and experience fit are matched against it specifically',
            'A second, independently-computed semantic match score is generated using sentence embeddings — not the LLM',
            'Actionable recommendations are generated to raise your score',
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
