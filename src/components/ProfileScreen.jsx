import Icon from './Icon.jsx'
import Dialog from './Dialog.jsx'
import { useState } from 'react'
import { api } from '../hooks/useApi.js'
import PasswordInput from './PasswordInput.jsx'

const S = {
  input: {
    background: 'var(--input-bg)',
    border: '1px solid var(--border-soft)',
    color: 'var(--text-primary)',
    padding: '10px 14px',
    borderRadius: 8,
    fontSize: 14,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  inputFocus: { border: '1px solid #6366f1' },
  label: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  hint: { fontSize: 11, color: 'var(--text-faint)', marginTop: 2 },
}

export default function ProfileScreen({ user, onSave, onClose }) {
  const [name, setName] = useState(user.name || '')
  const [username, setUsername] = useState(user.username || '')
  const [email, setEmail] = useState(user.email || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const handleSave = async () => {
    setError(null)
    if (!name || !username || !email)
      return setError('Nombre, usuario y email son requeridos')
    if (password && password !== confirm)
      return setError('Las contraseñas no coinciden')
    if (password && password.length < 10)
      return setError('La contraseña debe tener al menos 10 caracteres')
    setLoading(true)
    try {
      const result = await api.updateProfile({
        name,
        username,
        email,
        password: password || undefined,
        current_password: currentPassword,
      })
      localStorage.setItem('ft_token', result.token)
      localStorage.setItem('ft_user', JSON.stringify(result.user))
      setSuccess(true)
      setPassword('')
      setConfirm('')
      setTimeout(() => {
        setSuccess(false)
        onSave(result.user)
      }, 1500)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog onClose={onClose} label="Editar perfil" style={{ maxWidth: 440 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            fontWeight: 700,
            color: 'white',
            flexShrink: 0,
          }}
        >
          {name.charAt(0).toUpperCase()}
        </div>
        <div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}
          >
            Editar perfil
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            @{username || '...'}
          </div>
        </div>
      </div>

      {/* Campos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label style={S.label}>
          Nombre completo
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre"
            style={S.input}
          />
        </label>

        <label style={S.label}>
          Nombre de usuario
          <input
            value={username}
            onChange={(e) =>
              setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))
            }
            placeholder="ej: juan_perez"
            style={S.input}
          />
          <span style={S.hint}>
            Solo letras, números y guión bajo. Sin espacios.
          </span>
        </label>

        <label style={S.label}>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            style={S.input}
          />
        </label>

        <label style={S.label}>
          Contraseña actual (para cambiar email o contraseña)
          <PasswordInput
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            style={S.input}
          />
        </label>
        <div
          style={{
            borderTop: '1px solid var(--border)',
            paddingTop: 14,
            marginTop: 2,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-faint)',
              marginBottom: 10,
            }}
          >
            Dejá en blanco para no cambiar la contraseña
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={S.label}>
              Nueva contraseña
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 10 caracteres"
                style={S.input}
              />
            </label>
            <label style={S.label}>
              Confirmar contraseña
              <PasswordInput
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repetí la contraseña"
                style={S.input}
              />
            </label>
          </div>
        </div>

        {error && (
          <div
            style={{
              background: '#2d0a0a',
              border: '1px solid #dc2626',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 13,
              color: '#ef4444',
            }}
          >
            {error}
          </div>
        )}
        {success && (
          <div
            style={{
              background: '#052e16',
              border: '1px solid #16a34a',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 13,
              color: '#4ade80',
            }}
          >
            <Icon name="check" size={15} /> Perfil actualizado correctamente
          </div>
        )}
      </div>

      {/* Botones */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          justifyContent: 'flex-end',
          marginTop: 20,
        }}
      >
        <button
          onClick={onClose}
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-soft)',
            color: 'var(--text-secondary)',
            padding: '9px 18px',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={loading}
          style={{
            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            border: 'none',
            color: 'white',
            padding: '9px 20px',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? '⏳ Guardando...' : '💾 Guardar cambios'}
        </button>
      </div>
    </Dialog>
  )
}
