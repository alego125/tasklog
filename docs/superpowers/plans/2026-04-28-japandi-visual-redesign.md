# Japandi Visual Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the visual layer of the Cursor task management app with the Japandi style — warm linen tones, DM Serif Display italic for project titles, and CSS variable-based theming — without touching any business logic.

**Architecture:** Rewrite `theme.css` with Japandi tokens (linen light / charcoal dark), create `japandi.css` as a font + shadow override layer, add targeted `className` additions to components with hardcoded inline styles. A CSS class rename (`.light` → `.dark`) in `App.jsx` and `AuthScreen.jsx` flips the theme toggle direction. No logic changes.

**Tech Stack:** React 18, Vite 5, CSS variables, Google Fonts (DM Serif Display, Plus Jakarta Sans, DM Mono)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `index.html` | Modify | Add Google Fonts, fix body bg |
| `src/main.jsx` | Modify | Import japandi.css |
| `src/theme.css` | Rewrite | All CSS tokens, dark selector rename |
| `src/japandi.css` | Create | Font-family overrides, helper classes |
| `src/utils/helpers.js` | Modify | STATUS colors, COLORS palette |
| `src/App.jsx` | Modify | Theme toggle class, splash/error screens, modal overlays |
| `src/components/AuthScreen.jsx` | Modify | Layout + class updates |
| `src/components/Header.jsx` | Modify | className additions |
| `src/components/ProjectCard.jsx` | Modify | className + hardcoded color fixes |
| `src/components/TaskItem.jsx` | Modify | className + hardcoded color fixes |
| `src/components/Toast.jsx` | Modify | STYLES object replacement |
| `src/components/Modals.jsx` | Modify | Overlay + modal inner styles |

---

## Task 1: Create feature branch

**Files:** none (git only)

- [ ] **Step 1: Crear rama desde main**

```bash
cd "C:/Users/hp/Desktop/APPs Proyectos/cursor/tasklog-deploy"
git checkout -b feature/japandi-redesign
```

Expected output: `Switched to a new branch 'feature/japandi-redesign'`

- [ ] **Step 2: Verificar rama activa**

```bash
git branch
```

Expected: `* feature/japandi-redesign` marcado con asterisco.

---

## Task 2: Google Fonts + body background en index.html

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Reemplazar contenido de index.html**

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Cursor</title>
    <link rel="icon" type="image/png" href="/logo.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { background: #f5f0e8; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "style: add Google Fonts and set Japandi body background"
```

---

## Task 3: Reescribir theme.css con tokens Japandi

**Files:**
- Modify: `src/theme.css`

- [ ] **Step 1: Reemplazar el contenido completo de src/theme.css**

```css
/* ── Japandi Light (default) ────────────────────────────────── */
:root {
  --bg-base:        #f5f0e8;
  --bg-surface:     #ede8df;
  --bg-elevated:    #e6e0d4;
  --bg-hover:       #ede2d0;
  --border:         #ddd5c5;
  --border-soft:    #e8e0d0;
  --text-primary:   #2c2620;
  --text-secondary: #6b5e52;
  --text-muted:     #9c8e82;
  --text-faint:     #b8a898;
  --input-bg:       #f5f0e8;
  --accent:         #7a9e7e;
  --accent-deep:    #4a6e4e;
  --header-bg:      #ede8df;
  --splash-bg:      linear-gradient(135deg, #f5f0e8, #ede8df, #e6e0d4);
  --text-content:   #2c2620;
  --task-title:     #3a2e28;
  --btn-primary:    #2c2620;
  --btn-primary-text: #f5f0e8;
}

/* ── Japandi Dark ────────────────────────────────────────────── */
.dark {
  --bg-base:        #1e1a15;
  --bg-surface:     #2a241c;
  --bg-elevated:    #332b22;
  --bg-hover:       #3a3028;
  --border:         #3a3028;
  --border-soft:    #4a3e32;
  --text-primary:   #e8dfc8;
  --text-secondary: #b8a888;
  --text-muted:     #7a6e60;
  --text-faint:     #5a4e42;
  --input-bg:       #2a241c;
  --accent:         #7a9e7e;
  --accent-deep:    #9abf9e;
  --header-bg:      #2a241c;
  --splash-bg:      linear-gradient(135deg, #1e1a15, #2a241c, #332b22);
  --text-content:   #e8dfc8;
  --task-title:     #e8dfc8;
  --btn-primary:    #7a9e7e;
  --btn-primary-text: #1e1a15;
}

/* ── Transición suave al cambiar tema ────────────────────────── */
*, *::before, *::after {
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

/* ── Scrollbar ───────────────────────────────────────────────── */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: #f5f0e8; }
::-webkit-scrollbar-thumb { background: #ddd5c5; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #c8b8a8; }
.dark ::-webkit-scrollbar-track { background: #1e1a15; }
.dark ::-webkit-scrollbar-thumb { background: #3a3028; }

/* ── Responsive / Mobile ─────────────────────────────────────── */
@media (max-width: 600px) {
  .hide-mobile { display: none !important; }
  .mobile-only { display: flex !important; }
}
@media (min-width: 601px) {
  .mobile-only { display: none !important; }
}

@media (max-width: 600px) {
  .ft-header { padding: 10px 14px !important; gap: 8px !important; }
  .ft-header-logo { font-size: 15px !important; }
  .ft-header-sub  { display: none !important; }
  .ft-header-btns { gap: 6px !important; }
  .ft-header-btns button { padding: 7px 10px !important; font-size: 12px !important; }
}

@media (max-width: 600px) {
  .ft-filters { flex-direction: column !important; }
  .ft-filters > * { width: 100% !important; flex: none !important; box-sizing: border-box; }
  .ft-filters select { width: 100% !important; min-width: 0 !important; }
  .ft-filters input[type="date"] { width: 100% !important; min-width: 0 !important; }
  .ft-filters label { width: 100% !important; }
  .ft-search-wrap { width: 100% !important; }
  .ft-search-wrap input { width: 100% !important; min-width: 0 !important; }
  .ft-filter-row1 { flex-direction: column !important; }
  .ft-filter-row1 > * { width: 100% !important; flex: none !important; box-sizing: border-box; }
  .ft-filter-row1 select { width: 100% !important; }
  .ft-filter-row1 label { width: 100% !important; }
}

@media (max-width: 600px) {
  .ft-task-badge  { display: none !important; }
  .ft-task-meta   { flex-direction: column !important; gap: 3px !important; }
  .ft-task-actions { gap: 3px !important; }
  .ft-task-row    { padding: 9px 10px !important; gap: 8px !important; }
  .ft-task-comments { padding: 0 10px 12px 36px !important; }
}

@media (max-width: 600px) {
  .ft-proj-header { flex-direction: column !important; align-items: flex-start !important; gap: 8px !important; }
  .ft-proj-actions { width: 100% !important; justify-content: flex-end !important; }
  .ft-proj-badge  { font-size: 10px !important; }
}

@media (max-width: 600px) {
  .ft-new-task { flex-direction: column !important; }
  .ft-new-task > * { width: 100% !important; flex: none !important; box-sizing: border-box; }
}

@media (max-width: 600px) {
  .ft-stats { flex-wrap: wrap !important; gap: 6px !important; }
  .ft-stat-item { font-size: 11px !important; padding: 4px 8px !important; }
}

@media (max-width: 600px) {
  .ft-modal-inner {
    padding: 18px 16px !important;
    border-radius: 12px !important;
    margin: 0 8px !important;
  }
}

@media (max-width: 600px) {
  .ft-main { padding: 12px 10px !important; }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/theme.css
git commit -m "style: rewrite theme.css with Japandi tokens"
```

---

## Task 4: Crear japandi.css e importar en main.jsx

**Files:**
- Create: `src/japandi.css`
- Modify: `src/main.jsx`

- [ ] **Step 1: Crear src/japandi.css**

```css
/* ── Font family global ──────────────────────────────────────── */
body, input, select, textarea, button {
  font-family: 'Plus Jakarta Sans', 'Segoe UI', sans-serif;
}

/* ── Tipografía por rol ──────────────────────────────────────── */
.proj-title {
  font-family: 'DM Serif Display', serif !important;
  font-style: italic !important;
  font-weight: 400 !important;
}

.app-logo-text {
  font-family: 'DM Serif Display', serif !important;
  font-style: italic !important;
  font-weight: 400 !important;
}

.status-badge {
  font-family: 'DM Mono', monospace !important;
  font-size: 11px !important;
  letter-spacing: 0.3px !important;
}

/* ── Cards con sombra suave ──────────────────────────────────── */
.neu-card {
  box-shadow: 0 2px 12px rgba(44, 38, 32, 0.07), 0 1px 3px rgba(44, 38, 32, 0.05) !important;
}

.dark .neu-card {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25), 0 1px 3px rgba(0, 0, 0, 0.15) !important;
}

/* ── Hover suave en botones ──────────────────────────────────── */
button {
  transition: opacity 0.15s ease, background-color 0.15s ease, border-color 0.15s ease !important;
}

/* ── Focus ring cálido ───────────────────────────────────────── */
input:focus, select:focus, textarea:focus {
  outline: 2px solid var(--accent) !important;
  outline-offset: 1px !important;
}
```

- [ ] **Step 2: Agregar import en src/main.jsx**

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme.css'
import './japandi.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

- [ ] **Step 3: Commit**

```bash
git add src/japandi.css src/main.jsx
git commit -m "style: add japandi.css override layer"
```

---

## Task 5: Actualizar STATUS colors y COLORS en helpers.js

**Files:**
- Modify: `src/utils/helpers.js` líneas 14–21

- [ ] **Step 1: Reemplazar los objetos STATUS y COLORS**

Localizar el bloque que comienza con `export const STATUS = {` y reemplazarlo junto con la línea de COLORS:

```js
export const STATUS = {
  done:    { bg:'#edf5ee', border:'#b0cdb2', badge:'#7a9e7e', label:'Completada' },
  overdue: { bg:'#f5edec', border:'#cba8a8', badge:'#b05050', label:'Vencida'    },
  warning: { bg:'#faf0e6', border:'#c8a888', badge:'#c4784a', label:'Por vencer' },
  ok:      { bg:'transparent', border:'#ddd5c5', badge:'#9c8e82', label:'Sin vencer' },
}

export const COLORS = ['#7a9e7e','#c4784a','#4a8ea0','#9a7a5a','#887ab0','#4a8a70','#b07840','#7a8a4a']
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/helpers.js
git commit -m "style: update STATUS colors and project COLORS to Japandi palette"
```

---

## Task 6: Actualizar App.jsx — toggle de tema, splash, error y overlays de modales inline

**Files:**
- Modify: `src/App.jsx`

Hay 4 cambios en este archivo:

**Cambio A — useEffect del tema (línea ~92–96):**

```jsx
useEffect(() => {
  const hasUser = !!localStorage.getItem('ft_token')
  document.body.classList.toggle('dark', theme === 'dark' && hasUser)
  localStorage.setItem('ft_theme', theme)
}, [theme])
```

**Cambio B — doLogout (línea ~83–89):** cambiar `remove('light')` a `remove('dark')`:

```jsx
const doLogout = () => {
  localStorage.removeItem('ft_token')
  localStorage.removeItem('ft_user')
  localStorage.removeItem('ft_login_time')
  document.body.classList.remove('dark')
  setCurrentUser(null)
}
```

**Cambio C — Splash screen (línea ~225–235):** reemplazar el bloque `if (proj.loading) return (...)`:

```jsx
if (proj.loading) return (
  <div style={{ minHeight:'100vh', background:'var(--splash-bg)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:20, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
    <style>{`@keyframes flowbar{0%{transform:translateX(-100%)}100%{transform:translateX(400%)}}`}</style>
    <img src="/logo.png" alt="Cursor" style={{ width:72, height:72, borderRadius:18, objectFit:'cover', boxShadow:'0 4px 24px rgba(44,38,32,0.15)', marginBottom:4 }} />
    <div className="app-logo-text" style={{ fontSize:26, color:'var(--text-primary)', letterSpacing:'-0.5px' }}>Cursor</div>
    <div style={{ fontSize:13, color:'var(--text-muted)', fontFamily:"'DM Mono',monospace", letterSpacing:'1px' }}>Conectando con la base de datos...</div>
    <div style={{ width:140, height:3, background:'var(--bg-elevated)', borderRadius:999, overflow:'hidden', marginTop:4 }}>
      <div style={{ width:'40%', height:'100%', background:'var(--accent)', borderRadius:999, animation:'flowbar 1.2s ease-in-out infinite' }} />
    </div>
  </div>
)
```

**Cambio D — Error screen (línea ~237–244):** reemplazar el bloque `if (proj.error) return (...)`:

```jsx
if (proj.error) return (
  <div style={{ minHeight:'100vh', background:'var(--bg-base)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16, color:'var(--text-primary)', fontFamily:"'Plus Jakarta Sans',sans-serif", padding:24, textAlign:'center' }}>
    <div style={{ fontSize:36 }}>⚠</div>
    <div style={{ fontSize:18, fontWeight:700 }}>Error de conexión</div>
    <div style={{ color:'var(--text-secondary)', maxWidth:400, lineHeight:1.6 }}>{proj.error}</div>
    <button onClick={proj.loadProjects} style={{ background:'var(--btn-primary)', border:'none', color:'var(--btn-primary-text)', padding:'10px 24px', borderRadius:8, cursor:'pointer', fontSize:14, fontWeight:600 }}>Reintentar</button>
  </div>
)
```

**Cambio E — Overlay de los modales inline en App.jsx** (members modal línea ~256, backup modal línea ~301): cambiar `background:'#000b'` a `background:'rgba(44,38,32,0.45)'` en ambos overlays.

- [ ] **Step 1: Aplicar Cambio A — useEffect del tema**

Buscar el bloque:
```jsx
useEffect(() => {
  const hasUser = !!localStorage.getItem('ft_token')
  document.body.classList.toggle('light', theme === 'light' && hasUser)
  localStorage.setItem('ft_theme', theme)
}, [theme])
```
Reemplazar por el Cambio A de arriba.

- [ ] **Step 2: Aplicar Cambio B — doLogout**

Buscar `document.body.classList.remove('light')` en `doLogout` y cambiar a `remove('dark')`.

- [ ] **Step 3: Aplicar Cambio C — splash screen**

Reemplazar el bloque `if (proj.loading) return (...)` completo con el Cambio C de arriba.

- [ ] **Step 4: Aplicar Cambio D — error screen**

Reemplazar el bloque `if (proj.error) return (...)` completo con el Cambio D de arriba.

- [ ] **Step 5: Aplicar Cambio E — overlays de modales inline**

Buscar y reemplazar `background:'#000b'` (aparece dos veces en App.jsx — members modal y backup modal) con `background:'rgba(44,38,32,0.45)'`.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "style: update App.jsx theme toggle, splash/error screens and modal overlays"
```

---

## Task 7: Actualizar AuthScreen.jsx

**Files:**
- Modify: `src/components/AuthScreen.jsx`

- [ ] **Step 1: Reemplazar el contenido completo de AuthScreen.jsx**

```jsx
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
        <img src="/logo.png" alt="Cursor" style={{ width: 64, height: 64, borderRadius: 16, objectFit: 'cover', opacity: 0.9 }} />
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
            <img src="/logo.png" alt="Cursor" style={{ width: 56, height: 56, borderRadius: 14, objectFit: 'cover' }} />
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AuthScreen.jsx
git commit -m "style: redesign AuthScreen with Japandi split-panel layout"
```

---

## Task 8: Actualizar Header.jsx

**Files:**
- Modify: `src/components/Header.jsx`

Dos cambios puntuales:

**Cambio A** — Logo text: agregar `className="app-logo-text"` al div con "Cursor" (línea ~37):
```jsx
<div className="app-logo-text" style={{ fontSize:17, letterSpacing:'-0.5px' }}>Cursor</div>
```
(quitar `fontWeight:700` del inline style — la clase lo maneja)

**Cambio B** — Sub-texto: cambiar `fontFamily` a DM Mono (línea ~39):
```jsx
<div className="ft-header-sub" style={{ fontSize:10, color:'var(--text-muted)', fontFamily:"'DM Mono',monospace", letterSpacing:'0.5px' }}>
  <span style={{color:'var(--accent)'}}>● PostgreSQL</span> · Datos en la nube
</div>
```

- [ ] **Step 1: Aplicar Cambio A — logo text con className**

Buscar la línea:
```jsx
<div style={{ fontSize:17, fontWeight:700, letterSpacing:'-0.5px' }}>Cursor</div>
```
Reemplazar por:
```jsx
<div className="app-logo-text" style={{ fontSize:17, letterSpacing:'-0.5px' }}>Cursor</div>
```

- [ ] **Step 2: Aplicar Cambio B — sub-texto con DM Mono**

Buscar la línea:
```jsx
<div className="ft-header-sub" style={{ fontSize:10, color:'var(--text-muted)' }}>
```
Reemplazar por:
```jsx
<div className="ft-header-sub" style={{ fontSize:10, color:'var(--text-muted)', fontFamily:"'DM Mono',monospace", letterSpacing:'0.5px' }}>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Header.jsx
git commit -m "style: add Japandi typography classes to Header"
```

---

## Task 9: Actualizar ProjectCard.jsx

**Files:**
- Modify: `src/components/ProjectCard.jsx`

Cinco cambios:

**Cambio A** — Card wrapper (línea ~38): reemplazar colores hardcodeados por CSS variables y agregar `neu-card`:
```jsx
<div id={`project-${project.id}`} className="neu-card" style={{ background:'var(--bg-surface)', border:`1px solid ${hasOverdue?'#cba8a844':'var(--border-soft)'}`, borderRadius:14, marginBottom:16, overflow:'hidden' }}>
```

**Cambio B** — Project name span (línea ~44): agregar `className="proj-title"`:
```jsx
<span className="proj-title" onClick={() => onToggleCollapse(project.id)} style={{ fontSize:16, cursor:'pointer' }} title={isCollapsed?'Expandir':'Colapsar'}>{project.name}</span>
```

**Cambio C** — Porcentaje (añadir después del badge de conteo, línea ~46):
```jsx
{(() => {
  const total = project.tasks.length
  const done  = project.tasks.filter(t => t.done).length
  if (total === 0) return null
  const pct = Math.round(done / total * 100)
  return (
    <span style={{ fontFamily:"'DM Mono',monospace", fontSize:12, color:'var(--text-muted)', letterSpacing:'0.5px' }}>
      {pct}%
    </span>
  )
})()}
```

**Cambio D** — Badges de warning/overdue (líneas ~48–49): reemplazar colores hardcodeados:
```jsx
{hasOverdue && <span style={{ background:'#f5edec', border:'1px solid #cba8a8', borderRadius:20, padding:'1px 9px', fontSize:11, color:'#b05050', fontWeight:600 }}>⚠ Tareas vencidas</span>}
{!hasOverdue && hasWarning && <span style={{ background:'#faf0e6', border:'1px solid #c8a888', borderRadius:20, padding:'1px 9px', fontSize:11, color:'#c4784a', fontWeight:600 }}>⚠ Tareas por vencer</span>}
```

**Cambio E** — Botón "+ Nota" y botón miembros (líneas ~53–55): reemplazar colores hardcodeados:
```jsx
<button onClick={() => onNewProjNoteChange(project.id+'_open', !noteOpen)} style={{ background:'transparent', border:'1px solid var(--border)', color:'var(--text-secondary)', padding:'5px 12px', borderRadius:7, cursor:'pointer', fontSize:12, fontWeight:600 }}>+ Nota</button>
```
```jsx
<button onClick={() => onMembersModal(project.id)} title="Gestionar miembros" style={{ ...S.iconBtn }}>👥</button>
```

- [ ] **Step 1: Aplicar Cambio A — card wrapper**

Buscar la línea:
```jsx
<div id={`project-${project.id}`} style={{ background:'var(--bg-surface)', border:`1px solid ${hasOverdue?'#dc262644':'#1e293b'}`, borderRadius:14, marginBottom:16, overflow:'hidden' }}>
```
Reemplazar por Cambio A.

- [ ] **Step 2: Aplicar Cambio B — project name className**

Buscar la línea que contiene `fontWeight:700, fontSize:15, cursor:'pointer'` y el texto `{project.name}`, reemplazar por Cambio B.

- [ ] **Step 3: Aplicar Cambio C — porcentaje**

Insertar el bloque de porcentaje (Cambio C) después de la línea del badge de conteo (la que tiene `{project.tasks.filter(t=>!t.done).length} tarea...`).

- [ ] **Step 4: Aplicar Cambio D — badges de estado**

Buscar las dos líneas de `hasOverdue` y `hasWarning` badges y reemplazarlas por Cambio D.

- [ ] **Step 5: Aplicar Cambio E — botones con colores hardcodeados**

Buscar `border:'1px solid #4338ca', color:'#818cf8'` y reemplazar el botón "+ Nota" por Cambio E.
Buscar `borderColor:'#0e7490', color:'#22d3ee'` y reemplazar el botón miembros por Cambio E (sin borderColor ni color extra).

- [ ] **Step 6: Commit**

```bash
git add src/components/ProjectCard.jsx
git commit -m "style: update ProjectCard with Japandi classes and warm colors"
```

---

## Task 10: Actualizar TaskItem.jsx

**Files:**
- Modify: `src/components/TaskItem.jsx`

Tres cambios:

**Cambio A** — Border superior (línea ~9): reemplazar `#1e293b` por CSS variable:
```jsx
<div id={`task-${task.id}`} style={{ borderTop:'1px solid var(--border)', background:isExp?cfg.bg:'transparent', transition:'background .2s' }}>
```

**Cambio B** — Título de tarea (línea ~20): reemplazar colores hardcodeados `#ef4444` y `#f59e0b` por los del STATUS object:
```jsx
<div onClick={() => onExpand(isExp ? null : task.id)} style={{ fontWeight:600, fontSize:14, textDecoration:task.done?'line-through':'none', color:task.done?'var(--text-faint)':(status==='overdue'?cfg.badge:status==='warning'?cfg.badge:'var(--task-title)'), wordBreak:'break-word', overflowWrap:'break-word', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }} title={isExp?'Colapsar':'Expandir bitácora'}>
  {task.title}
</div>
```

**Cambio C** — Badge de estado (línea ~32): agregar `className="status-badge"`:
```jsx
<div className="ft-task-badge status-badge" style={{ background:`${cfg.badge}22`, border:`1px solid ${cfg.badge}55`, color:cfg.badge, padding:'3px 9px', borderRadius:20, fontSize:11, fontWeight:600, whiteSpace:'nowrap', flexShrink:0 }}>
  {cfg.label}
</div>
```
(quitar el `● ` del label ya que STATUS.label ya tiene el texto)

- [ ] **Step 1: Aplicar Cambio A — border superior**

Buscar `borderTop:'1px solid #1e293b'` y reemplazar por `borderTop:'1px solid var(--border)'`.

- [ ] **Step 2: Aplicar Cambio B — colores del título**

En el div del título, reemplazar `status==='overdue'?'#ef4444':status==='warning'?'#f59e0b'` por `status==='overdue'?cfg.badge:status==='warning'?cfg.badge`. Agregar también `fontFamily:"'Plus Jakarta Sans',sans-serif"` al style.

- [ ] **Step 3: Aplicar Cambio C — badge con className**

Buscar el div con `className="ft-task-badge"` y agregar `status-badge` al className. Cambiar `● {cfg.label}` a solo `{cfg.label}`.

- [ ] **Step 4: Commit**

```bash
git add src/components/TaskItem.jsx
git commit -m "style: update TaskItem with Japandi colors and status-badge class"
```

---

## Task 11: Actualizar Toast.jsx

**Files:**
- Modify: `src/components/Toast.jsx`

- [ ] **Step 1: Reemplazar el objeto STYLES con colores Japandi**

Buscar el bloque:
```js
const STYLES = {
  success: { bg:'#052e16', border:'#16a34a', icon:'✅', color:'#4ade80' },
  error:   { bg:'#2d0a0a', border:'#dc2626', icon:'❌', color:'#f87171' },
  warning: { bg:'#2d1f00', border:'#d97706', icon:'⚠️', color:'#fbbf24' },
  info:    { bg:'#0f172a', border:'#6366f1', icon:'ℹ️', color:'#818cf8' },
}
```
Reemplazar por:
```js
const STYLES = {
  success: { bg:'#edf5ee', border:'#b0cdb2', icon:'✓', color:'#2c5e30' },
  error:   { bg:'#f5edec', border:'#cba8a8', icon:'✕', color:'#6e2828' },
  warning: { bg:'#faf0e6', border:'#c8a888', icon:'⚠', color:'#7a4820' },
  info:    { bg:'#edf0f8', border:'#b0b8d4', icon:'i', color:'#2a3a6e' },
}
```

- [ ] **Step 2: Actualizar el box-shadow del toast** (línea ~27):

Buscar `boxShadow: '0 8px 32px #00000066'` y reemplazar por:
```js
boxShadow: '0 4px 20px rgba(44,38,32,0.12)',
fontFamily: "'Plus Jakarta Sans', sans-serif",
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Toast.jsx
git commit -m "style: update Toast colors to Japandi warm palette"
```

---

## Task 12: Actualizar Modals.jsx

**Files:**
- Modify: `src/components/Modals.jsx`

Dos cambios globales que aplican a todos los modales:

**Cambio A** — Todos los overlays: cambiar `background:'#000b'` a `background:'rgba(44,38,32,0.45)'`

**Cambio B** — Títulos de modal: agregar `className="proj-title"` a los divs de título que tengan `fontSize:16, fontWeight:700`

- [ ] **Step 1: Reemplazar overlays**

Usar búsqueda y reemplazo en el archivo: cambiar todas las ocurrencias de `background:'#000b'` por `background:'rgba(44,38,32,0.45)'`.

- [ ] **Step 2: Agregar proj-title a títulos de modal**

Buscar los divs con estilo `fontSize:16, fontWeight:700` que son títulos de modal (Confirm, EditProject, EditTask, etc.) y agregar `className="proj-title"` a cada uno.

- [ ] **Step 3: Commit**

```bash
git add src/components/Modals.jsx
git commit -m "style: update Modals overlays and titles for Japandi"
```

---

## Task 13: Verificación visual y commit final

**Files:** ninguno (verificación)

- [ ] **Step 1: Levantar el servidor de desarrollo**

```bash
cd "C:/Users/hp/Desktop/APPs Proyectos/cursor/tasklog-deploy"
npm run dev
```

Abrir `http://localhost:5173` en el browser.

- [ ] **Step 2: Verificar criterios del spec**

Recorrer la app y confirmar cada ítem:

| Criterio | Verificar en |
|---|---|
| Fondo lino `#f5f0e8` visible | Toda la app |
| Nombres de proyectos en DM Serif Display italic | Vista proyectos |
| Botones primarios en sumi sólido (no gradient) | Header, modales |
| Estados de tareas en DM Mono lowercase | Cada tarea |
| Dark mode funcional con carbón cálido | Toggle tema |
| Login con panel partido sumi/lino | Pantalla de login |
| Toasts con fondo crema (no neón) | Crear/editar tarea |
| Sin regresiones en filtros, modales y exportación | Probar cada función |

- [ ] **Step 3: Commit de cierre si todo OK**

```bash
git add -A
git commit -m "style: Japandi visual redesign complete — ready for review"
```

- [ ] **Step 4: Reportar al usuario para aprobación**

Indicar al usuario que el rediseño está completo en la rama `feature/japandi-redesign` y esperar su aprobación antes de hacer merge a `main`.
