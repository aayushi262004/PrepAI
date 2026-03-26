import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import SplashPage from './pages/SplashPage'
import AuthPage from './pages/AuthPage'
import HomePage from './pages/HomePage'
import InterviewPage from './pages/InterviewPage'
import ResumeAnalysisPage from './pages/ResumeAnalysisPage'
import ATSScorePage from './pages/ATSScorePage'
import DashboardLayout from './components/layout/DashboardLayout'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen bg-surface flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
  </div>
  if (!user) return <Navigate to="/auth" replace />
  return children
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (user) return <Navigate to="/home" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public */}
        <Route path="/" element={<SplashPage />} />
        <Route path="/auth" element={<PublicRoute><AuthPage /></PublicRoute>} />

        {/* Protected */}
        <Route path="/home" element={<ProtectedRoute><DashboardLayout><HomePage /></DashboardLayout></ProtectedRoute>} />
        <Route path="/interview" element={<ProtectedRoute><DashboardLayout><InterviewPage /></DashboardLayout></ProtectedRoute>} />
        <Route path="/resume" element={<ProtectedRoute><DashboardLayout><ResumeAnalysisPage /></DashboardLayout></ProtectedRoute>} />
        <Route path="/ats" element={<ProtectedRoute><DashboardLayout><ATSScorePage /></DashboardLayout></ProtectedRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}