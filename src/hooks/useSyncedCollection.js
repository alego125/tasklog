import { subscribeChanges, announceChange } from '../utils/changes.js'
import { useState, useRef, useCallback, useEffect } from 'react'

export function useSyncedCollection(fetchItems) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(0)
  const [lastUpdated, setLastUpdated] = useState(null)
  const alive = useRef(true)
  const fetchRef = useRef(fetchItems)
  fetchRef.current = fetchItems
  const queue = useRef(Promise.resolve())
  const revision = useRef(0)
  const mutations = useRef(0)
  const load = useCallback(async (silent = false) => {
    if (!localStorage.getItem('ft_token')) {
      setLoading(false)
      return
    }
    const version = ++revision.current
    if (!silent) setLoading(true)
    try {
      const result = await fetchRef.current()
      if (alive.current && version === revision.current) {
        setItems(result)
        setError(null)
        setLastUpdated(new Date())
        return result
      }
    } catch (e) {
      if (alive.current && version === revision.current)
        setError(e.message === 'SIN_CONEXION' ? 'No se pudo conectar con el servidor.' : e.message)
    } finally {
      if (alive.current && version === revision.current) setLoading(false)
    }
  }, [])
  // Writes are serialized. No full-list snapshots can overwrite later edits.
  const mutate = useCallback((operation, apply) => {
    const sessionToken = localStorage.getItem('ft_token')
    mutations.current++
    revision.current++
    setPending((n) => n + 1)
    const job = queue.current.then(async () => {
      if (!alive.current || sessionToken !== localStorage.getItem('ft_token'))
        throw new Error('La sesión cambió')
      const result = await operation()
      if (!alive.current || sessionToken !== localStorage.getItem('ft_token'))
        throw new Error('La sesión cambió')
      if (alive.current) {
        revision.current++ // discard any refresh started before this commit
        if (apply) setItems((prev) => apply(prev, result))
        setLastUpdated(new Date())
        announceChange()
      }
      return result
    })
    queue.current = job.catch(() => {})
    return job.finally(() => {
      mutations.current--
      if (alive.current) setPending((n) => n - 1)
    })
  }, [])
  useEffect(() => {
    alive.current = true
    const refresh = () => {
      if (!document.hidden && !mutations.current) load(true)
    }
    const timer = setInterval(refresh, 30000)
    window.addEventListener('focus', refresh)
    const unsubscribe = subscribeChanges(refresh)
    return () => {
      alive.current = false
      revision.current++
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
      unsubscribe()
    }
  }, [load])
  return { items, setItems, loading, error, pending, lastUpdated, load, mutate }
}
