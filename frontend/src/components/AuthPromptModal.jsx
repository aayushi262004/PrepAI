import { motion, AnimatePresence } from 'framer-motion'
import { X, Lock } from 'lucide-react'

export default function AuthPromptModal({ open, featureName, onClose, onLogin, onGetStarted }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 z-40"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="glass-card w-full max-w-sm pointer-events-auto relative"
            >
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-ink-faint hover:text-ink transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="w-10 h-10 rounded-xl bg-surface-300 border border-line-strong flex items-center justify-center mb-4">
                <Lock className="w-4 h-4 text-brand-400" />
              </div>

              <h2 className="text-lg font-display font-bold text-ink mb-1.5">
                Sign in to try {featureName}
              </h2>
              <p className="text-sm text-ink-muted mb-6">
                Create a free account or log in — it takes less than a minute.
              </p>

              <div className="flex gap-3">
                <button onClick={onLogin} className="btn-secondary flex-1">Log In</button>
                <button onClick={onGetStarted} className="btn-primary flex-1">Get Started</button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
