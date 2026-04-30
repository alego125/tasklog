import { useState, useEffect } from 'react'
import { api } from '../hooks/useApi.js'

export default function AuthScreen({ onAuth }) {
  useEffect(() => {
    document.body.classList.remove('dark')
  }, [])

  const [mode, setMode]       = useState('login')
  const [name, setName]       = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail]     = useState('')
  const [password, setPass]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const handleSubmit = async () => {
    if (mode === 'login' && (!username || !password)) return setError('Completá todos los campos')
    if (mode === 'register' && (!name || !username || !email || !password)) return setError('Completá todos los campos')
    setLoading(true)
    setError(null)
    try {
      const result = mode === 'login'
        ? await api.login(username, password)
        : await api.register(name, username, email, password)
      localStorage.setItem('ft_token', result.token)
      localStorage.setItem('ft_user', JSON.stringify(result.user))
      onAuth(result.user)
    } catch(e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleKey = e => { if (e.key === 'Enter') handleSubmit() }

  const inputStyle = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-soft)',
    color: 'var(--text-primary)',
    padding: '10px 14px',
    borderRadius: 8,
    fontSize: 14,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  }

  const labelStyle = {
    fontSize: 12,
    color: 'var(--text-muted)',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontFamily: "'DM Mono', monospace",
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg-base)' }}>

      {/* Panel izquierdo — sumi oscuro */}
      <div style={{ width: '40%', minWidth: 260, background: '#2c2620', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 40px', gap: 20 }} className="hide-mobile">
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#7a9e7e', marginBottom: 8 }} />
        <img src="/logo.png" alt="Cursor" style={{ width: 76, height: 76, borderRadius: 18, objectFit: 'cover', opacity: 0.9 }} />
        <div className="app-logo-text" style={{ fontSize: 32, color: '#f5f0e8', letterSpacing: '-0.5px', textAlign: 'center' }}>Cursor</div>
        <div style={{ fontSize: 13, color: '#9c8e82', lineHeight: 1.6, textAlign: 'center', maxWidth: 220, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 300 }}>
          Sistema de seguimiento de tareas con persistencia en la nube.
        </div>
        <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#7a9e7e', fontFamily: "'DM Mono', monospace", letterSpacing: '1px' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#7a9e7e', display: 'inline-block' }} />
          PostgreSQL · Datos en la nube
        </div>
      </div>

      {/* Panel derecho — lino cálido */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', background: 'var(--bg-base)' }}>
        <div style={{ width: '100%', maxWidth: 380 }}>

          {/* Logo mobile (solo visible en mobile) */}
          <div className="mobile-only" style={{ flexDirection: 'column', alignItems: 'center', marginBottom: 32, gap: 8 }}>
            <img src="/logo.png" alt="Cursor" style={{ width: 68, height: 68, borderRadius: 16, objectFit: 'cover' }} />
            <div className="app-logo-text" style={{ fontSize: 24, color: 'var(--text-primary)' }}>Cursor</div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', background: 'var(--bg-surface)', borderRadius: 10, padding: 3, marginBottom: 28, gap: 3, border: '1px solid var(--border-soft)' }}>
            {['login', 'register'].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(null) }}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, transition: 'all .2s',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  background: mode === m ? 'var(--btn-primary)' : 'transparent',
                  color: mode === m ? 'var(--btn-primary-text)' : 'var(--text-muted)',
                }}>
                {m === 'login' ? 'Iniciar sesión' : 'Registrarse'}
              </button>
            ))}
          </div>

          {/* Campos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {mode === 'register' && (
              <label style={labelStyle}>
                Nombre completo
                <input value={name} onChange={e => setName(e.target.value)} onKeyDown={handleKey} placeholder="Tu nombre" style={inputStyle} autoFocus />
              </label>
            )}
            <label style={labelStyle}>
              Usuario
              <input value={username} onChange={e => setUsername(e.target.value)} onKeyDown={handleKey} placeholder={mode === 'register' ? 'ej: juan_perez' : 'Tu usuario'} style={inputStyle} autoFocus={mode === 'login'} />
            </label>
            {mode === 'register' && (
              <label style={labelStyle}>
                Email
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={handleKey} placeholder="tu@email.com" style={inputStyle} />
              </label>
            )}
            <label style={labelStyle}>
              Contraseña
              <input type="password" value={password} onChange={e => setPass(e.target.value)} onKeyDown={handleKey} placeholder="••••••••" style={inputStyle} />
            </label>

            {error && (
              <div style={{ background: '#f5edec', border: '1px solid #cba8a8', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#b05050', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {error}
              </div>
            )}

            <button onClick={handleSubmit} disabled={loading}
              style={{ background: 'var(--btn-primary)', border: 'none', color: 'var(--btn-primary-text)', padding: '12px 0', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, width: '100%', opacity: loading ? 0.7 : 1, marginTop: 4, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {loading ? 'Cargando...' : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
