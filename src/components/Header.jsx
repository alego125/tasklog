import { S } from '../utils/helpers.js'

export default function Header({
  currentUser, theme, archiveView, projects,
  onNewProject, onArchiveView,
  onExportExcel, onExportPDF, onBackup, onToggleTheme,
  onProfile, onLogout,
  userMenuOpen, setUserMenuOpen,
  mobileMenuOpen, setMobileMenuOpen,
  mobileSubMenu, setMobileSubMenu,
  loadArchived,
}) {
  const menuBtn = (onClick, color, children, extra={}) => (
    <button onClick={onClick}
      style={{ width:'100%', background:'transparent', border:'none', color, padding:'10px 16px', cursor:'pointer', fontSize:13, textAlign:'left', display:'flex', alignItems:'center', gap:10, ...extra }}
      onMouseEnter={e=>e.currentTarget.style.background='var(--bg-elevated)'}
      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
      {children}
    </button>
  )

  const mobileMenuBtn = (onClick, color, children, extra={}) => (
    <button onClick={onClick}
      style={{ width:'100%', background:'transparent', border:'none', color, padding:'12px 16px', cursor:'pointer', fontSize:13, textAlign:'left', display:'flex', alignItems:'center', gap:10, borderBottom:'1px solid var(--border)', ...extra }}
      onMouseEnter={e=>e.currentTarget.style.background='var(--bg-elevated)'}
      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
      {children}
    </button>
  )

  return (
    <div className="ft-header" style={{ background:'var(--header-bg)', borderBottom:'1px solid var(--border)', padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100, gap:10 }}>

      {/* Logo */}
      <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
        <img src="/logo.png" alt="Cursor" style={{ width:34, height:34, borderRadius:8, objectFit:'cover' }} />
        <div>
          <div className="app-logo-text" style={{ fontSize:17, letterSpacing:'-0.5px' }}>Cursor</div>
          <div className="ft-header-sub" style={{ fontSize:10, color:'var(--text-muted)', fontFamily:"'DM Mono',monospace", letterSpacing:'0.5px' }}><span style={{color:'var(--accent)'}}>● PostgreSQL</span> · Datos en la nube</div>
        </div>
      </div>

      {/* ── DESKTOP ── */}
      <div className="hide-mobile" style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        {archiveView && (
          <button onClick={() => onArchiveView(false)} style={{ background:'#78350f', border:'1px solid #d97706', color:'#fbbf24', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:13 }}>
            ← Volver
          </button>
        )}
        {!archiveView && <button onClick={onNewProject} style={{ ...S.btnPrimary, background:'#76D128', color:'#1a2e10' }}>+ Nuevo Proyecto</button>}

        {/* Avatar desktop */}
        <div style={{ position:'relative', borderLeft:'1px solid var(--border)', paddingLeft:12, marginLeft:4 }}>
          <button onClick={() => setUserMenuOpen(v=>!v)} style={{ display:'flex', alignItems:'center', gap:8, background:'transparent', border:'none', cursor:'pointer', padding:'4px 6px', borderRadius:8 }}>
            <div style={{ width:30, height:30, borderRadius:'50%', background:'#76D128', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#1a2e10', flexShrink:0 }}>
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize:13, color:'var(--text-secondary)', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{currentUser.name}</span>
            <span style={{ fontSize:10, color:'var(--text-faint)' }}>▾</span>
          </button>

          {userMenuOpen && (
            <>
              <div onClick={() => { setUserMenuOpen(false); setMobileSubMenu(false) }} style={{ position:'fixed', inset:0, zIndex:150 }} />
              <div style={{ position:'absolute', right:0, top:'calc(100% + 8px)', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:10, minWidth:200, boxShadow:'0 10px 40px #00000088', zIndex:200, overflow:'hidden' }}>
                <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)' }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>{currentUser.name}</div>
                  <div style={{ fontSize:11, color:'var(--text-faint)', marginTop:2 }}>@{currentUser.username||currentUser.email}</div>
                </div>
                {!archiveView && menuBtn(() => { onExportExcel(projects); setUserMenuOpen(false) }, '#34d399', '⬇ Exportar Excel')}
                {!archiveView && menuBtn(() => { onExportPDF(projects); setUserMenuOpen(false) }, '#f97316', '📄 Generar prompt informe')}
                {menuBtn(() => { if(!archiveView) loadArchived(); onArchiveView(v=>!v); setUserMenuOpen(false) }, '#fbbf24', `📦 ${archiveView?'Volver a proyectos':'Archivados'}`)}
                {!archiveView && menuBtn(() => { onBackup(); setUserMenuOpen(false) }, 'var(--text-secondary)', '💾 Backup y restauración')}
                {menuBtn(() => { onToggleTheme(); setUserMenuOpen(false) }, 'var(--text-secondary)', theme==='dark'?'☀️ Modo claro':'🌙 Modo oscuro', { borderTop:'1px solid var(--border)' })}
                {menuBtn(() => { setUserMenuOpen(false); onProfile() }, 'var(--text-secondary)', '✏️ Editar perfil')}
                {menuBtn(() => { setUserMenuOpen(false); onLogout() }, '#ef4444', '⎋ Cerrar sesión', { borderTop:'1px solid var(--border)' })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── MOBILE ── */}
      <div className="mobile-only" style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
        {!archiveView && <button onClick={onNewProject} style={{ ...S.btnPrimary, background:'#76D128', color:'#1a2e10', padding:'8px 12px', fontSize:12 }}>+ Proyecto</button>}
        {archiveView && (
          <button onClick={() => onArchiveView(false)} style={{ background:'#78350f', border:'1px solid #d97706', color:'#fbbf24', padding:'8px 12px', borderRadius:8, cursor:'pointer', fontSize:12 }}>
            ← Volver
          </button>
        )}
        {/* Botón hamburguesa */}
        <button onClick={() => setMobileMenuOpen(v=>!v)} style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-soft)', color:'var(--text-secondary)', width:38, height:38, borderRadius:8, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4, flexShrink:0, padding:0 }}>
          <span style={{ display:'block', width:16, height:2, background:'currentColor', borderRadius:2 }}/>
          <span style={{ display:'block', width:16, height:2, background:'currentColor', borderRadius:2 }}/>
          <span style={{ display:'block', width:16, height:2, background:'currentColor', borderRadius:2 }}/>
        </button>
      </div>

      {/* Menú hamburguesa MOBILE */}
      {mobileMenuOpen && (
        <>
          <div onClick={() => { setMobileMenuOpen(false); setMobileSubMenu(false) }} style={{ position:'fixed', inset:0, zIndex:150 }} />
          <div style={{ position:'fixed', right:12, top:64, background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:12, width:240, maxWidth:'calc(100vw - 24px)', boxShadow:'0 10px 40px #00000099', zIndex:200, display:'block', overflowY:'auto', maxHeight:'calc(100vh - 80px)' }}>

            {/* Fila usuario */}
            <button onClick={() => setMobileSubMenu(v=>!v)} style={{ width:'100%', background:'transparent', border:'none', borderBottom:'1px solid var(--border)', padding:'13px 16px', cursor:'pointer', display:'flex', alignItems:'center', gap:10, textAlign:'left' }}>
              <div style={{ width:32, height:32, borderRadius:'50%', background:'#76D128', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#1a2e10', flexShrink:0 }}>
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>{currentUser.name}</div>
                <div style={{ fontSize:11, color:'var(--text-faint)' }}>@{currentUser.username||currentUser.email}</div>
              </div>
              <span style={{ fontSize:11, color:'var(--text-faint)' }}>{mobileSubMenu?'▲':'▶'}</span>
            </button>

            {/* Submenu usuario */}
            {mobileSubMenu && (
              <div style={{ background:'var(--bg-hover)', borderBottom:'1px solid var(--border)' }}>
                {mobileMenuBtn(() => { onToggleTheme(); setMobileMenuOpen(false); setMobileSubMenu(false) }, 'var(--text-secondary)', theme==='dark'?'☀️ Modo claro':'🌙 Modo oscuro')}
                {mobileMenuBtn(() => { setMobileMenuOpen(false); setMobileSubMenu(false); onProfile() }, 'var(--text-secondary)', '✏️ Editar perfil')}
                <button onClick={() => { setMobileMenuOpen(false); setMobileSubMenu(false); onLogout() }}
                  style={{ width:'100%', background:'transparent', border:'none', color:'#ef4444', padding:'10px 16px 10px 16px', cursor:'pointer', fontSize:13, textAlign:'left', display:'flex', alignItems:'center', gap:10 }}
                  onMouseEnter={e=>e.currentTarget.style.background='#2d0a0a'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  ⎋ Cerrar sesión
                </button>
              </div>
            )}

            {/* Opciones generales */}
            {!archiveView && mobileMenuBtn(() => { onExportExcel(projects); setMobileMenuOpen(false) }, '#34d399', '⬇ Exportar Excel')}
            {!archiveView && mobileMenuBtn(() => { onExportPDF(projects); setMobileMenuOpen(false) }, '#f97316', '📄 Generar prompt informe')}
            {mobileMenuBtn(() => { if(!archiveView) loadArchived(); onArchiveView(v=>!v); setMobileMenuOpen(false) }, '#fbbf24', `📦 ${archiveView?'Volver a proyectos':'Archivados'}`)}
            {!archiveView && (
              <button onClick={() => { onBackup(); setMobileMenuOpen(false) }}
                style={{ width:'100%', background:'transparent', border:'none', color:'var(--text-secondary)', padding:'12px 16px', cursor:'pointer', fontSize:13, textAlign:'left', display:'flex', alignItems:'center', gap:10 }}
                onMouseEnter={e=>e.currentTarget.style.background='var(--bg-elevated)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                💾 Backup y restauración
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
