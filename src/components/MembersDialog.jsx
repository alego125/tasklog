import { useState, useEffect } from 'react'
import Dialog from './Dialog.jsx'
import { api } from '../hooks/useApi.js'
export default function MembersDialog({ project, user, onClose, onAdd, onRemove, onError }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const owner = project?.owner_id === user.id
  useEffect(() => {
    let active = true
    const timer = setTimeout(async () => {
      if (query.trim().length < 2) {
        setResults([])
        return
      }
      try {
        const users = await api.searchUsers(query.trim())
        if (active) {
          setResults(users.filter((u) => !project.members.some((m) => m.id === u.id)))
          setError(null)
        }
      } catch (e) {
        if (active) setError(e.message)
      }
    }, 250)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [query, project])
  if (!project) return null
  const run = async (action) => {
    setBusy(true)
    try {
      await action()
      setQuery('')
      setResults([])
    } catch (e) {
      setError(e.message)
      onError(e)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog onClose={onClose} label={`Miembros de ${project.name}`}>
      <h2>Miembros de {project.name}</h2>
      <ul style={{ padding: 0, listStyle: 'none' }}>
        {project.members.map((member) => (
          <li
            key={member.id}
            style={{ padding: '8px 0', display: 'flex', gap: 12, justifyContent: 'space-between' }}
          >
            <span>
              {member.name} ({member.email}) · {member.role === 'owner' ? 'Propietario' : 'Miembro'}
            </span>
            {owner && member.id !== project.owner_id && (
              <button
                disabled={busy}
                onClick={() => run(() => onRemove(project.id, member.id))}
                aria-label={`Quitar a ${member.name}`}
              >
                Quitar
              </button>
            )}
          </li>
        ))}
      </ul>
      {owner && (
        <>
          <label>
            Buscar miembros por nombre o email
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: 8 }}
            />
          </label>
          {results.map((u) => (
            <div key={u.id} style={{ padding: 8 }}>
              {u.name} ({u.email}){' '}
              <button disabled={busy} onClick={() => run(() => onAdd(project.id, u.id))}>
                Agregar
              </button>
            </div>
          ))}
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="dialog-actions">
        <button onClick={onClose}>Cerrar</button>
      </div>
    </Dialog>
  )
}
