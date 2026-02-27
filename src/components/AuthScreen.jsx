import { useState, useEffect } from 'react'
import { api } from '../hooks/useApi.js'

const S = {
  input: { background:'var(--input-bg)', border:'1px solid var(--border-soft)', color:'var(--text-primary)', padding:'10px 14px', borderRadius:8, fontSize:14, outline:'none', width:'100%', boxSizing:'border-box' },
  label: { fontSize:13, color:'var(--text-secondary)', display:'flex', flexDirection:'column', gap:6 },
  btnPrimary: { background:'linear-gradient(135deg,#6366f1,#8b5cf6)', border:'none', color:'white', padding:'11px 0', borderRadius:8, cursor:'pointer', fontSize:14, fontWeight:600, width:'100%' },
}

export default function AuthScreen({ onAuth }) {
  // Siempre oscuro en login, sin excepción
  useEffect(() => {
    document.body.classList.remove('light')
  }, [])
  const [mode, setMode]       = useState('login') // 'login' | 'register'
  const [name, setName]         = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPass]     = useState('')
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

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#070d1a 0%,#0f172a 50%,#1e1b4b 100%)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'DM Sans','Segoe UI',sans-serif", padding:'20px 12px' }}>
      <div style={{ width:'100%', maxWidth:400 }}>

        {/* Logo y título */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <img src="/logo.png" alt="FlowTracker" style={{ width:72, height:72, borderRadius:18, objectFit:'cover', boxShadow:'0 0 40px #6366f155', marginBottom:16 }} />
          <div style={{ fontSize:26, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.5px' }}>FlowTracker</div>
          <div style={{ fontSize:13, color:'var(--text-faint)', marginTop:4 }}>Gestión de proyectos y tareas</div>
        </div>

        {/* Card */}
        <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:16, padding:28, boxShadow:'0 20px 60px #00000066' }}>
          {/* Tabs */}
          <div style={{ display:'flex', background:'var(--bg-elevated)', borderRadius:10, padding:3, marginBottom:24, gap:3 }}>
            {['login','register'].map(m => (
              <button key={m} onClick={()=>{ setMode(m); setError(null) }}
                style={{ flex:1, padding:'8px 0', borderRadius:8, border:'none', cursor:'pointer', fontSize:13, fontWeight:600, transition:'all .2s',
                  background: mode===m ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'transparent',
                  color: mode===m ? 'white' : '#64748b' }}>
                {m === 'login' ? 'Iniciar sesión' : 'Registrarse'}
              </button>
            ))}
          </div>

          {/* Campos */}
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {mode === 'register' && (
              <label style={S.label}>
                Nombre completo
                <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={handleKey} placeholder="Tu nombre" style={S.input} autoFocus />
              </label>
            )}
            <label style={S.label}>
              Nombre de usuario
              <input value={username} onChange={e=>setUsername(e.target.value)} onKeyDown={handleKey} placeholder={mode==='register' ? 'ej: juan_perez' : 'Tu usuario'} style={S.input} autoFocus={mode==='login'} />
            </label>
            {mode === 'register' && (
              <label style={S.label}>
                Email
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={handleKey} placeholder="tu@email.com" style={S.input} />
              </label>
            )}
            <label style={S.label}>
              Contraseña
              <input type="password" value={password} onChange={e=>setPass(e.target.value)} onKeyDown={handleKey} placeholder={mode==='register' ? 'Mínimo 6 caracteres' : '••••••••'} style={S.input} />
            </label>

            {error && (
              <div style={{ background:'#2d0a0a', border:'1px solid #dc2626', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#ef4444' }}>
                {error}
              </div>
            )}

            <button onClick={handleSubmit} disabled={loading} style={{ ...S.btnPrimary, opacity: loading ? 0.7 : 1, marginTop:4 }}>
              {loading ? '⏳ Cargando...' : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
