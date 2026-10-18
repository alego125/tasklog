import Icon, { Brand } from './Icon.jsx'
import { useState, useEffect } from 'react'
import { api } from '../hooks/useApi.js'
import PasswordInput from './PasswordInput.jsx'

export default function AuthScreen({ onAuth }) {
  useEffect(() => {
    document.body.classList.remove('dark')
  }, [])

  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPass] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async () => {
    if (loading) return
    if (mode === 'login' && (!username || !password))
      return setError('Completá todos los campos')
    if (mode === 'register' && (!name || !username || !email || !password))
      return setError('Completá todos los campos')
    setLoading(true)
    setError(null)
    try {
      const result =
        mode === 'login'
          ? await api.login(username, password)
          : await api.register(name, username, email, password)
      localStorage.setItem('ft_token', result.token)
      localStorage.setItem('ft_user', JSON.stringify(result.user))
      onAuth(result.user)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%',
    minHeight: 46,
    padding: '11px 13px',
    border: '1px solid var(--border)',
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    borderRadius: 8,
    fontSize: 13,
  }
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <Brand />
        <div className="auth-story-content">
          <span className="auth-kicker">MENOS RUIDO. MÁS FOCO.</span>
          <h1>
            Tu trabajo,
            <br />
            con más claridad.
          </h1>
          <p>
            Proyectos, tareas y conversaciones.
            <br />
            Todo conectado para avanzar mejor.
          </p>
          <div className="auth-preview" aria-hidden="true">
            <div className="preview-heading">
              <span>
                <Icon name="folder" size={17} />
                Lanzamiento del proyecto
              </span>
              <Icon name="more" size={18} />
            </div>
            <div className="preview-progress">
              <span />
            </div>
            <div className="preview-caption">
              Cada paso cuenta <strong>67%</strong>
            </div>
            {[
              ['check', 'Definir los próximos pasos', true],
              ['check', 'Compartir ideas con el equipo', true],
              ['clock', 'Hacer que suceda', false],
            ].map(([icon, text, done]) => (
              <div
                key={text}
                className={`preview-task ${done ? 'complete' : ''}`}
              >
                <Icon name={icon} size={16} />
                <span>{text}</span>
                {!done && <span className="preview-pill">En marcha</span>}
              </div>
            ))}
            <div className="preview-note">
              <Icon name="message" size={14} />
              El contexto también es parte del trabajo.
            </div>
          </div>
        </div>
        <div className="auth-story-footer">
          <span className="sync-dot" />
          Un espacio para lo que viene.
        </div>
      </section>
      <section className="auth-form-area">
        <div className="auth-form-wrap">
          <div className="auth-mobile-brand">
            <Brand />
          </div>
          <span className="auth-welcome">TU ESPACIO DE TRABAJO</span>
          <h2>
            {mode === 'login'
              ? 'Bienvenido a Cursor'
              : 'Creá tu cuenta en Cursor'}
          </h2>
          <p className="auth-description">
            {mode === 'login'
              ? 'Ingresá para continuar donde lo dejaste.'
              : 'Creá tu cuenta y empezá a organizar tu trabajo.'}
          </p>
          <div className="auth-tabs">
            {['login', 'register'].map((m) => (
              <button
                key={m}
                aria-pressed={mode === m}
                onClick={() => {
                  setMode(m)
                  setError(null)
                }}
              >
                {m === 'login' ? 'Iniciar sesión' : 'Registrarse'}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSubmit()
            }}
            className="auth-form"
          >
            {mode === 'register' && (
              <label>
                Nombre completo
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  autoComplete="name"
                  style={inputStyle}
                  required
                />
              </label>
            )}
            <label>
              Usuario
              <input
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={
                  mode === 'register' ? 'ej: juan_perez' : 'Tu usuario'
                }
                style={inputStyle}
                required
              />
            </label>
            {mode === 'register' && (
              <label>
                Email
                <input
                  autoComplete="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  style={inputStyle}
                  required
                />
              </label>
            )}
            <label>
              Contraseña
              <PasswordInput
                value={password}
                onChange={(e) => setPass(e.target.value)}
                placeholder="Ingresá tu contraseña"
                autoComplete={
                  mode === 'login' ? 'current-password' : 'new-password'
                }
                style={inputStyle}
              />
            </label>
            {mode === 'register' && (
              <p className="auth-help">
                Usá al menos 10 caracteres. El usuario debe tener entre 3 y 40
                letras, números o guiones bajos.
              </p>
            )}
            {error && (
              <div role="alert" className="auth-error">
                {error}
              </div>
            )}
            <button
              type="submit"
              className="button button-primary auth-submit"
              disabled={loading}
            >
              {loading
                ? 'Cargando…'
                : mode === 'login'
                  ? 'Iniciar sesión'
                  : 'Crear cuenta'}
              <Icon name="arrow" size={16} />
            </button>
          </form>
          <p className="auth-footnote">
            Un lugar para organizar, colaborar y avanzar.
          </p>
        </div>
      </section>
    </main>
  )
}
