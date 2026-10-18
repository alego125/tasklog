import { useState, useRef, useEffect, useCallback } from 'react'
import { subscribeChanges } from '../utils/changes.js'
export function useArchivedCollection(fetcher) {
  const [items, setItems] = useState([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(null)
  const fetchRef = useRef(fetcher)
  fetchRef.current = fetcher
  const active = useRef(false),
    alive = useRef(true),
    revision = useRef(0)
  const load = useCallback(async (silent = false) => {
    active.current = true
    const version = ++revision.current
    if (!silent) setLoading(true)
    try {
      const rows = await fetchRef.current()
      if (alive.current && revision.current === version) {
        setItems(rows)
        setError(null)
      }
    } catch (e) {
      if (alive.current && revision.current === version) setError(e.message)
    } finally {
      if (alive.current && revision.current === version) setLoading(false)
    }
  }, [])
  useEffect(() => {
    alive.current = true
    const refresh = () => {
      if (active.current && !document.hidden) load(true)
    }
    const timer = setInterval(refresh, 30000),
      unsubscribe = subscribeChanges(refresh)
    window.addEventListener('focus', refresh)
    return () => {
      alive.current = false
      revision.current++
      clearInterval(timer)
      unsubscribe()
      window.removeEventListener('focus', refresh)
    }
  }, [load])
  return { items, setItems, loading, error, load }
}
