import { useState, useEffect, useCallback, useRef } from 'react'
import { api, clearSession } from './useApi.js'
export function useSession() {
  const epoch = useRef(0)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const login = useCallback((user) => {
    epoch.current++
    setUser(user)
    setError(null)
    setLoading(false)
  }, [])
  const logout = useCallback(() => {
    // Capture the request's token before clearing browser state.
    api.logout().catch(() => {})
    clearSession()
  }, [])
  const verify = useCallback(async () => {
    const version = ++epoch.current
    if (!localStorage.getItem('ft_token')) {
      setUser(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await api.me()
      if (version === epoch.current) setUser(result)
    } catch (e) {
      if (version === epoch.current) {
        setUser(null)
        if (e.status !== 401) setError(e.message)
      }
    } finally {
      if (version === epoch.current) setLoading(false)
    }
  }, [])
  useEffect(() => {
    verify()
    const reset = () => {
      epoch.current++
      setUser(null)
      setLoading(false)
      setError(null)
      document.body.classList.remove('dark')
    }
    const storage = (e) => {
      if (e.key === 'ft_token') {
        reset()
        verify()
      }
    }
    window.addEventListener('ft_logout', reset)
    window.addEventListener('storage', storage)
    return () => {
      window.removeEventListener('ft_logout', reset)
      window.removeEventListener('storage', storage)
    }
  }, [verify])
  useEffect(() => {
    if (!user) return
    let timer
    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(logout, 20 * 60 * 1000)
    }
    const events = ['pointerdown', 'keydown', 'touchstart', 'scroll']
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    reset()
    return () => {
      clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [user, logout])
  return { user, loading, error, login, logout, verify }
}
