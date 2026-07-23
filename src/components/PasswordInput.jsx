import { useState } from 'react'

const EyeIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const EyeOffIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.53 13.53 0 0 0 1 11s4 7 11 7a9.16 9.16 0 0 0 5.39-1.61M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    <path d="M1 1l22 22" />
  </svg>
)

export default function PasswordInput({ value, onChange, onKeyDown, placeholder, style, autoFocus, id }) {
  const [visible, setVisible] = useState(false)
  return (
    <div style={{ position:'relative', width:'100%' }}>
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        style={{ ...style, paddingRight:38, boxSizing:'border-box' }}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        tabIndex={-1}
        title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        style={{ position:'absolute', right:4, top:'50%', transform:'translateY(-50%)', background:'transparent', border:'none', cursor:'pointer', padding:6, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)' }}
      >
        {visible ? EyeOffIcon : EyeIcon}
      </button>
    </div>
  )
}
