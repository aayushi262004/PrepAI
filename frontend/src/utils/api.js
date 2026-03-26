import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 60000,
})

// Response interceptor - only redirect on 401 for NON-auth routes
api.interceptors.response.use(
  res => res,
  err => {
    const url = err.config?.url || ''
    const isAuthRoute = url.includes('/auth/login') || url.includes('/auth/signup')

    // Only force-redirect if a protected route gets 401 (expired token), not during login itself
    if (err.response?.status === 401 && !isAuthRoute) {
      localStorage.removeItem('token')
      window.location.href = '/auth'
    }

    // Log errors in dev so you can see exactly what's happening
    if (import.meta.env.DEV) {
      console.error('API error:', err.config?.url, err.response?.status, err.response?.data)
    }

    return Promise.reject(err)
  }
)

export default api