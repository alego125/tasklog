import { useState, useMemo, useEffect } from 'react'
import { api } from './hooks/useApi.js'
import { useProjects } from './hooks/useProjects.js'
import { getStatus, COLORS, S, exportExcel } from './utils/helpers.js'
import AuthScreen    from './components/AuthScreen.jsx'
import ProfileScreen from './components/ProfileScreen.jsx'
import Header        from './components/Header.jsx'
import ProjectCard   from './components/ProjectCard.jsx'
import { Confirm, EditProject, EditTask, EditComment, MoveNoteModal, MoveCommentModal } from './components/Modals.jsx'

export default function App() {

  // ── Auth & theme ─────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ft_user')) } catch { return null }
  })
  const [theme, setTheme] = useState(() => localStorage.getItem('ft_theme') || 'dark')

  useEffect(() => {
    const hasUser = !!localStorage.getItem('ft_token')
    document.body.classList.toggle('light', theme === 'light' && hasUser)
    localStorage.setItem('ft_theme', theme)
  }, [theme])

  useEffect(() => {
    const handler = () => setCurrentUser(null)
    window.addEventListener('ft_logout', handler)
    return () => window.removeEventListener('ft_logout', handler)
  }, [])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  const doLogout = () => {
    localStorage.removeItem('ft_token')
    localStorage.removeItem('ft_user')
    localStorage.removeItem('ft_login_time')
    document.body.classList.remove('light')
    setCurrentUser(null)
  }

  useEffect(() => {
    if (!currentUser) return
    const SESSION_MS = 90 * 60 * 1000
    const loginTime  = parseInt(localStorage.getItem('ft_login_time') || '0')
    const remaining  = SESSION_MS - (Date.now() - loginTime)
    if (remaining <= 0) { doLogout(); return }
    const timer = setTimeout(() => { doLogout(); alert('Tu sesión expiró. Por favor iniciá sesión nuevamente.') }, remaining)
    const handleFocus = () => { if (Date.now() - parseInt(localStorage.getItem('ft_login_time')||'0') >= SESSION_MS) doLogout() }
    window.addEventListener('focus', handleFocus)
    return () => { clearTimeout(timer); window.removeEventListener('focus', handleFocus) }
  }, [currentUser])

  // ── Data hook ─────────────────────────────────────────────────
  const proj = useProjects()

  // ── UI state ──────────────────────────────────────────────────
  const [search,             setSearch]             = useState('')
  const [filterStatus,       setFilterStatus]       = useState('all')
  const [filterProject,      setFilterProject]      = useState('all')
  const [filterDateFrom,     setFilterDateFrom]     = useState('')
  const [filterDateTo,       setFilterDateTo]       = useState('')
  const [showDone,           setShowDone]           = useState(false)
  const [expanded,           setExpanded]           = useState(null)
  const [expandedNotes,      setExpandedNotes]      = useState({})
  const [collapsedProjects,  setCollapsedProjects]  = useState({})
  const [newComment,         setNewComment]         = useState({})
  const [newProjNote,        setNewProjNote]        = useState({})
  const [newTaskFor,         setNewTaskFor]         = useState(null)
  const [newTask,            setNewTask]            = useState({ title:'', responsible:'', due_date:'' })
  const [newProjOpen,        setNewProjOpen]        = useState(false)
  const [newProjName,        setNewProjName]        = useState('')
  const [newProjColor,       setNewProjColor]       = useState('#6366f1')
  const [archiveView,        setArchiveView]        = useState(false)
  const [backupModal,        setBackupModal]        = useState(false)
  const [restoring,          setRestoring]          = useState(false)
  const [restoreMsg,         setRestoreMsg]         = useState(null)
  const [membersModal,       setMembersModal]       = useState(null)
  const [memberSearch,       setMemberSearch]       = useState('')
  const [memberResults,      setMemberResults]      = useState([])
  const [profileOpen,        setProfileOpen]        = useState(false)
  const [userMenuOpen,       setUserMenuOpen]       = useState(false)
  const [mobileMenuOpen,     setMobileMenuOpen]     = useState(false)
  const [mobileSubMenu,      setMobileSubMenu]      = useState(false)
  const [editProject,        setEditProject]        = useState(null)
  const [editTask,           setEditTask]           = useState(null)
  const [editComment,        setEditComment]        = useState(null)
  const [editNote,           setEditNote]           = useState(null)
  const [confirm,            setConfirm]            = useState(null)
  const [moveNote,           setMoveNote]           = useState(null)
  const [moveComment,        setMoveComment]        = useState(null)

  // ── Filters ───────────────────────────────────────────────────
  const filtered = useMemo(() => proj.allTasks.filter(t => {
    const st = getStatus(t.due_date, t.done)
    const q  = search.toLowerCase()
    const matchSearch = !q || t.title.toLowerCase().includes(q) || t.projectName.toLowerCase().includes(q) ||
      (t.responsible||'').toLowerCase().includes(q) ||
      t.comments.some(c => c.text.toLowerCase().includes(q) || (c.author||'').toLowerCase().includes(q))
    return matchSearch &&
      (filterStatus==='all' || st===filterStatus) &&
      (filterProject==='all' || t.projectId===parseInt(filterProject)) &&
      (showDone || !t.done) &&
      (!filterDateFrom || (t.created_at && t.created_at >= filterDateFrom)) &&
      (!filterDateTo   || (t.created_at && t.created_at <= filterDateTo + 'T99'))
  }), [proj.allTasks, search, filterStatus, filterProject, showDone, filterDateFrom, filterDateTo])

  const filteredProjectNotes = useMemo(() => {
    if (!search.trim()) return []
    const q = search.toLowerCase()
    return proj.projects
      .filter(p => filterProject==='all' || p.id===parseInt(filterProject))
      .flatMap(p => (p.notes||[])
        .filter(n => {
          if (!n.text.toLowerCase().includes(q) && !(n.author||'').toLowerCase().includes(q)) return false
          if (filterDateFrom && String(n.created_at).slice(0,10) < filterDateFrom) return false
          if (filterDateTo   && String(n.created_at).slice(0,10) > filterDateTo)   return false
          return true
        })
        .map(n => ({ ...n, projectId:p.id, projectName:p.name, projectColor:p.color }))
      )
  }, [proj.projects, search, filterProject, filterDateFrom, filterDateTo])

  const matchingComments = useMemo(() => {
    if (!search.trim()) return {}
    const q = search.toLowerCase()
    const result = {}
    proj.allTasks.forEach(t => {
      if (filterProject!=='all' && t.projectId!==parseInt(filterProject)) return
      if (filterDateFrom && t.created_at && t.created_at < filterDateFrom) return
      if (filterDateTo   && t.created_at && t.created_at > filterDateTo + 'T99') return
      const hits = t.comments.filter(c => c.text.toLowerCase().includes(q) || (c.author||'').toLowerCase().includes(q))
      if (hits.length) result[t.id] = hits
    })
    return result
  }, [proj.allTasks, search, filterProject, filterDateFrom, filterDateTo])

  const doneTasks = proj.allTasks.filter(t => t.done)

  const showConfirm = (msg, action, opts={}) => setConfirm({ msg, action, ...opts })

  const doSearchMembers = async q => {
    setMemberSearch(q)
    if (q.length < 2) { setMemberResults([]); return }
    try {
      const results = await api.searchUsers(q)
      const project = proj.projects.find(p => p.id === membersModal)
      const memberIds = (project?.members||[]).map(m => m.id)
      setMemberResults(results.filter(u => !memberIds.includes(u.id)))
    } catch {}
  }

  // ── Auth guard ────────────────────────────────────────────────
  if (!currentUser) return (
    <AuthScreen onAuth={user => {
      localStorage.setItem('ft_login_time', Date.now().toString())
      setCurrentUser(user)
      document.body.classList.toggle('light', (localStorage.getItem('ft_theme')||'dark') === 'light')
      proj.loadProjects()
    }} />
  )

  if (proj.loading) return (
    <div style={{ minHeight:'100vh', background:'var(--splash-bg)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:20, fontFamily:'sans-serif' }}>
      <style>{`@keyframes flowbar{0%{transform:translateX(-100%)}100%{transform:translateX(400%)}}`}</style>
      <img src="/logo.png" alt="FlowTracker" style={{ width:80, height:80, borderRadius:20, objectFit:'cover', boxShadow:'0 0 40px #6366f155' }} />
      <div style={{ fontSize:20, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.5px' }}>FlowTracker</div>
      <div style={{ fontSize:13, color:'var(--text-muted)' }}>Conectando con la base de datos...</div>
      <div style={{ width:160, height:4, background:'var(--bg-elevated)', borderRadius:999, overflow:'hidden', marginTop:4 }}>
        <div style={{ width:'40%', height:'100%', background:'linear-gradient(90deg,#6366f1,#8b5cf6)', borderRadius:999, animation:'flowbar 1.2s ease-in-out infinite' }} />
      </div>
    </div>
  )

  if (proj.error) return (
    <div style={{ minHeight:'100vh', background:'var(--bg-base)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16, color:'var(--text-primary)', fontFamily:'sans-serif', padding:24, textAlign:'center' }}>
      <div style={{ fontSize:40 }}>⚠️</div>
      <div style={{ fontSize:18, fontWeight:700 }}>Error de conexión</div>
      <div style={{ color:'var(--text-secondary)', maxWidth:400, lineHeight:1.6 }}>{proj.error}</div>
      <button onClick={proj.loadProjects} style={{ background:'#6366f1', border:'none', color:'white', padding:'10px 24px', borderRadius:8, cursor:'pointer', fontSize:14 }}>Reintentar</button>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-base)', fontFamily:"'DM Sans','Segoe UI',sans-serif", color:'var(--text-primary)' }}>

      {/* ── Modals ── */}
      {profileOpen && <ProfileScreen user={currentUser} onSave={user => { setCurrentUser(user); setProfileOpen(false) }} onClose={() => setProfileOpen(false)} />}

      {membersModal && (() => {
        const project = proj.projects.find(p => p.id === membersModal)
        if (!project) return null
        return (
          <div onClick={() => setMembersModal(null)} style={{ position:'fixed', inset:0, background:'#000b', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div onClick={e=>e.stopPropagation()} className="ft-modal-inner" style={{ background:'var(--bg-surface)', border:'1px solid var(--border-soft)', borderRadius:14, padding:28, width:'100%', maxWidth:460, boxShadow:'0 30px 80px #0009' }}>
              <div style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>👥 Miembros del proyecto</div>
              <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:20 }}>{project.name}</div>
              <div style={{ marginBottom:16 }}>
                {(project.members||[]).map(m => (
                  <div key={m.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'var(--bg-elevated)', borderRadius:8, marginBottom:6 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,#6366f1,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'white' }}>{m.name.charAt(0).toUpperCase()}</div>
                      <div>
                        <div style={{ fontSize:13, color:'var(--text-primary)' }}>{m.name}</div>
                        <div style={{ fontSize:11, color:'var(--text-faint)' }}>{m.email}</div>
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:11, color:m.role==='owner'?'#f59e0b':'#64748b', background:m.role==='owner'?'#451a03':'#1e293b', border:`1px solid ${m.role==='owner'?'#92400e':'#334155'}`, padding:'2px 8px', borderRadius:10 }}>{m.role==='owner'?'Propietario':'Miembro'}</span>
                      {m.role !== 'owner' && m.id !== currentUser.id && (
                        <button onClick={() => proj.doRemoveMember(project.id, m.id)} style={{ background:'transparent', border:'1px solid #dc262633', color:'#ef4444', borderRadius:6, padding:'3px 8px', cursor:'pointer', fontSize:12 }}>✕</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ borderTop:'1px solid var(--border)', paddingTop:16 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--text-secondary)', marginBottom:8 }}>Agregar miembro</div>
                <input placeholder="Buscar por nombre o email..." value={memberSearch} onChange={e=>doSearchMembers(e.target.value)} style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-soft)', color:'var(--text-primary)', padding:'8px 12px', borderRadius:8, fontSize:13, outline:'none', width:'100%', boxSizing:'border-box', marginBottom:8 }} />
                {memberResults.map(u => (
                  <div key={u.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'var(--bg-elevated)', borderRadius:8, marginBottom:6 }}>
                    <div>
                      <div style={{ fontSize:13, color:'var(--text-primary)' }}>{u.name}</div>
                      <div style={{ fontSize:11, color:'var(--text-faint)' }}>{u.email}</div>
                    </div>
                    <button onClick={() => { proj.doAddMember(membersModal, u.id); setMemberResults(prev=>prev.filter(x=>x.id!==u.id)) }} style={{ background:'#065f46', border:'1px solid #059669', color:'#34d399', padding:'5px 12px', borderRadius:7, cursor:'pointer', fontSize:12, fontWeight:600 }}>+ Agregar</button>
                  </div>
                ))}
                {memberSearch.length >= 2 && memberResults.length === 0 && <div style={{ fontSize:13, color:'var(--text-faint)', textAlign:'center', padding:'8px 0' }}>No se encontraron usuarios</div>}
              </div>
              <div style={{ display:'flex', justifyContent:'flex-end', marginTop:16 }}>
                <button onClick={() => setMembersModal(null)} style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-soft)', color:'var(--text-secondary)', padding:'8px 18px', borderRadius:8, cursor:'pointer', fontSize:13 }}>Cerrar</button>
              </div>
            </div>
          </div>
        )
      })()}

      {backupModal && (
        <div onClick={() => setBackupModal(false)} style={{ position:'fixed', inset:0, background:'#000b', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div onClick={e=>e.stopPropagation()} className="ft-modal-inner" style={{ background:'var(--bg-surface)', border:'1px solid var(--border-soft)', borderRadius:14, padding:28, width:'100%', maxWidth:460, boxShadow:'0 30px 80px #0009' }}>
            <div style={{ fontSize:16, fontWeight:700, marginBottom:6 }}>💾 Backup y Restauración</div>
            <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:24 }}>Descargá un backup completo o restaurá desde un archivo previo.</div>
            <div style={{ background:'var(--bg-hover)', border:'1px solid var(--border)', borderRadius:10, padding:16, marginBottom:12 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', marginBottom:4 }}>⬇ Descargar backup</div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:12 }}>Exporta todos los proyectos, tareas, notas y bitácoras en un archivo JSON.</div>
              <button onClick={proj.doBackup} style={{ background:'#065f46', border:'1px solid #059669', color:'#34d399', padding:'8px 18px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 }}>⬇ Descargar backup</button>
            </div>
            <div style={{ background:'var(--bg-hover)', border:'1px solid var(--border)', borderRadius:10, padding:16, marginBottom:16 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', marginBottom:4 }}>⬆ Restaurar desde backup</div>
              <div style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:4 }}>⚠ Esto <strong>reemplaza todos los datos actuales</strong> con los del archivo.</div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:12 }}>Seleccioná un archivo .json generado por FlowTracker.</div>
              <label style={{ display:'inline-block', background:'#7c3aed', border:'none', color:'white', padding:'8px 18px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 }}>
                {restoring ? '⏳ Restaurando...' : '⬆ Seleccionar archivo'}
                <input type="file" accept=".json" disabled={restoring} onChange={e => proj.doRestore(e.target.files[0], ({ loading:l, msg:m }) => { setRestoring(l); if(m) setRestoreMsg(m) })} style={{ display:'none' }} />
              </label>
              {restoreMsg && <div style={{ marginTop:12, fontSize:13, color:restoreMsg.ok?'#34d399':'#ef4444', background:restoreMsg.ok?'#052e16':'#2d0a0a', border:`1px solid ${restoreMsg.ok?'#16a34a':'#dc2626'}`, borderRadius:8, padding:'10px 14px', lineHeight:1.5 }}>{restoreMsg.text}</div>}
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end' }}>
              <button onClick={() => setBackupModal(false)} style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-soft)', color:'var(--text-secondary)', padding:'8px 18px', borderRadius:8, cursor:'pointer', fontSize:13 }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {confirm     && <Confirm msg={confirm.msg} onOk={()=>{confirm.action();setConfirm(null)}} onCancel={()=>setConfirm(null)} title={confirm.title} okLabel={confirm.okLabel} okColor={confirm.okColor} />}
      {editProject && <EditProject project={editProject} onSave={(name,color) => { proj.doSaveEditProject(editProject,name,color); setEditProject(null) }} onClose={()=>setEditProject(null)} />}
      {editTask    && <EditTask task={editTask.task} onSave={form => { proj.doSaveEditTask(editTask.pId,editTask.task.id,form); setEditTask(null) }} onClose={()=>setEditTask(null)} />}
      {editComment && <EditComment comment={editComment.comment} onSave={text => { proj.doSaveEditComment(editComment.pId,editComment.tId,editComment.comment.id,text); setEditComment(null) }} onClose={()=>setEditComment(null)} />}
      {editNote    && <EditComment comment={editNote.note}       onSave={text => { proj.doSaveEditNote(editNote.pId,editNote.note.id,text); setEditNote(null) }}           onClose={()=>setEditNote(null)} />}
      {moveNote    && <MoveNoteModal note={moveNote.note} tasks={proj.allTasks.filter(t=>!t.done)} onMove={taskId => { proj.doMoveNoteToTask(moveNote.note,moveNote.pId,taskId,proj.allTasks); setMoveNote(null) }} onClose={()=>setMoveNote(null)} />}
      {moveComment && <MoveCommentModal comment={moveComment.comment} projects={proj.projects} currentProjectId={moveComment.pId} onMove={projectId => { proj.doMoveCommentToProject(moveComment.comment,moveComment.pId,moveComment.tId,projectId); setMoveComment(null) }} onClose={()=>setMoveComment(null)} />}

      {/* ── Header ── */}
      <Header
        currentUser={currentUser} theme={theme} archiveView={archiveView} projects={proj.projects}
        onNewProject={() => setNewProjOpen(true)}
        onArchiveView={v => setArchiveView(typeof v === 'function' ? v(archiveView) : v)}
        onExportExcel={exportExcel}
        onBackup={() => { setBackupModal(true); setRestoreMsg(null) }}
        onToggleTheme={toggleTheme}
        onProfile={() => setProfileOpen(true)}
        onLogout={doLogout}
        userMenuOpen={userMenuOpen}   setUserMenuOpen={setUserMenuOpen}
        mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen}
        mobileSubMenu={mobileSubMenu}   setMobileSubMenu={setMobileSubMenu}
        loadArchived={proj.loadArchived}
      />

      {/* ── Archive view ── */}
      {archiveView ? (
        <div className="ft-main" style={{ maxWidth:1200, margin:'0 auto', padding:'28px 20px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
            <span style={{ fontSize:18, fontWeight:700, color:'#fbbf24' }}>📦 Proyectos Archivados</span>
            {proj.loadingArchived  && <span style={{ fontSize:13, color:'var(--text-muted)' }}>Cargando...</span>}
            {!proj.loadingArchived && <span style={{ fontSize:13, color:'var(--text-muted)' }}>{proj.archivedProjects.length} proyecto{proj.archivedProjects.length!==1?'s':''}</span>}
          </div>
          {!proj.loadingArchived && proj.archivedProjects.length===0 && <div style={{ textAlign:'center', color:'var(--text-faint)', fontSize:14, padding:40 }}>No hay proyectos archivados.</div>}
          {proj.archivedProjects.map(project => (
            <div key={project.id} style={{ background:'var(--bg-surface)', border:'1px solid var(--border-soft)', borderRadius:14, marginBottom:12, overflow:'hidden', opacity:0.85 }}>
              <div style={{ borderLeft:`4px solid ${project.color}`, padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', background:`linear-gradient(90deg,${project.color}11,transparent)` }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:9, height:9, borderRadius:'50%', background:project.color }} />
                  <span style={{ fontWeight:700, fontSize:15, color:'var(--text-secondary)' }}>{project.name}</span>
                  <span style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-soft)', borderRadius:20, padding:'1px 9px', fontSize:11, color:'var(--text-faint)' }}>{project.tasks.length} tarea{project.tasks.length!==1?'s':''} · {project.notes?.length||0} nota{(project.notes?.length||0)!==1?'s':''}</span>
                  <span style={{ background:'#451a03', border:'1px solid #92400e', borderRadius:20, padding:'1px 9px', fontSize:11, color:'#fbbf24' }}>📦 Archivado</span>
                </div>
                <div style={{ display:'flex', gap:7 }}>
                  <button onClick={() => showConfirm(`¿Restaurar "${project.name}" a la pantalla principal?`, () => proj.doUnarchiveProject(project.id), { title:'↩ Confirmar restauración', okLabel:'Restaurar', okColor:'#059669' })} style={{ background:'#065f46', border:'1px solid #059669', color:'#34d399', padding:'6px 14px', borderRadius:7, cursor:'pointer', fontSize:12, fontWeight:600 }}>↩ Restaurar</button>
                  <button onClick={() => showConfirm(`¿Eliminar "${project.name}" y TODAS sus tareas y notas? Esta acción no se puede deshacer.`, () => proj.doDeleteProject(project.id))} style={{ ...S.iconBtn, borderColor:'#dc262633', color:'#ef4444' }} title="Eliminar permanentemente">🗑</button>
                </div>
              </div>
              <div style={{ padding:'8px 16px', fontSize:12, color:'var(--text-faint)', display:'flex', gap:16, borderTop:'1px solid var(--border)' }}>
                <span>📌 {project.tasks.filter(t=>!t.done).length} pendiente{project.tasks.filter(t=>!t.done).length!==1?'s':''}</span>
                <span>✅ {project.tasks.filter(t=>t.done).length} completada{project.tasks.filter(t=>t.done).length!==1?'s':''}</span>
                <span>📝 {project.notes?.length||0} nota{(project.notes?.length||0)!==1?'s':''}</span>
              </div>
            </div>
          ))}
        </div>

      ) : (
        <div style={{ maxWidth:1200, margin:'0 auto', padding:'28px 20px' }}>

          {/* Filtros */}
          <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:12, padding:'14px 16px', marginBottom:18 }}>
            <div className="ft-filter-row1" style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center', marginBottom:10 }}>
              <div className="ft-search-wrap" style={{ position:'relative', flex:'1 1 220px', display:'flex', alignItems:'center' }}>
                <input placeholder="🔍 Buscar por tarea, proyecto o responsable..." value={search} onChange={e=>setSearch(e.target.value)} style={{ ...S.input, width:'100%', paddingRight:search?'32px':'12px' }} />
                {search && <button onClick={() => setSearch('')} style={{ position:'absolute', right:8, background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:16, lineHeight:1, padding:'2px 4px', display:'flex', alignItems:'center' }}>✕</button>}
              </div>
              <select value={filterStatus}  onChange={e=>setFilterStatus(e.target.value)}  style={{ ...S.select, flex:'1 1 150px' }}>
                <option value="all">Todos los estados</option>
                <option value="warning">Por vencer (≤3 días)</option>
                <option value="overdue">Vencidas</option>
                <option value="done">Completadas</option>
              </select>
              <select value={filterProject} onChange={e=>setFilterProject(e.target.value)} style={{ ...S.select, flex:'1 1 150px' }}>
                <option value="all">Todos los proyectos</option>
                {proj.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <label style={{ display:'flex', alignItems:'center', gap:7, fontSize:13, cursor:'pointer', whiteSpace:'nowrap' }}>
                <input type="checkbox" checked={showDone} onChange={e=>setShowDone(e.target.checked)} style={{ accentColor:'#6366f1' }} /> Mostrar completadas
              </label>
            </div>
            <div className="ft-filters" style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
              <span style={{ fontSize:12, color:'var(--text-muted)', whiteSpace:'nowrap' }}>📅 Filtrar por fecha de registro:</span>
              <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--text-secondary)' }}>Desde <input type="date" value={filterDateFrom} onChange={e=>setFilterDateFrom(e.target.value)} style={{ ...S.input, padding:'5px 8px', fontSize:12 }} /></label>
              <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--text-secondary)' }}>Hasta <input type="date" value={filterDateTo}   onChange={e=>setFilterDateTo(e.target.value)}   style={{ ...S.input, padding:'5px 8px', fontSize:12 }} /></label>
              {(filterDateFrom||filterDateTo) && <button onClick={()=>{setFilterDateFrom('');setFilterDateTo('')}} style={{ ...S.btnSecondary, padding:'5px 10px', fontSize:12 }}>✕ Limpiar fechas</button>}
            </div>
          </div>

          {/* Stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))', gap:10, marginBottom:18 }}>
            {[
              { label:'Total',       val:proj.allTasks.length,                                                    color:'#6366f1' },
              { label:'Por vencer',  val:proj.allTasks.filter(t=>getStatus(t.due_date,t.done)==='warning').length, color:'#f59e0b' },
              { label:'Vencidas',    val:proj.allTasks.filter(t=>getStatus(t.due_date,t.done)==='overdue').length, color:'#ef4444' },
              { label:'Completadas', val:doneTasks.length,                                                         color:'#22c55e' },
              { label:'Proyectos',   val:proj.projects.length,                                                     color:'#8b5cf6' },
            ].map(s => (
              <div key={s.label} style={{ background:'var(--bg-surface)', border:`1px solid ${s.color}44`, borderRadius:10, padding:'12px 14px', textAlign:'center' }}>
                <div style={{ fontSize:24, fontWeight:800, color:s.color }}>{s.val}</div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Nuevo proyecto */}
          {newProjOpen && (
            <div style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-soft)', borderRadius:12, padding:14, marginBottom:16, display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
              <input placeholder="Nombre del proyecto..." value={newProjName} onChange={e=>setNewProjName(e.target.value)}
                onKeyDown={e => { if(e.key==='Enter' && newProjName.trim()) proj.doAddProject(newProjName,newProjColor).then(()=>{ setNewProjName(''); setNewProjOpen(false) }) }}
                style={{ ...S.input, flex:1 }} autoFocus />
              <div style={{ display:'flex', gap:6 }}>
                {COLORS.map(c => <div key={c} onClick={() => setNewProjColor(c)} style={{ width:22, height:22, borderRadius:'50%', background:c, cursor:'pointer', border:newProjColor===c?'3px solid white':'3px solid transparent', boxSizing:'border-box' }} />)}
              </div>
              <button onClick={() => proj.doAddProject(newProjName,newProjColor).then(()=>{ setNewProjName(''); setNewProjOpen(false) })} style={S.btnPrimary}>Crear</button>
              <button onClick={() => setNewProjOpen(false)} style={S.btnSecondary}>Cancelar</button>
            </div>
          )}

          {/* Resultados búsqueda en bitácoras */}
          {search.trim() && (filteredProjectNotes.length > 0 || Object.keys(matchingComments).length > 0) && (
            <div style={{ background:'var(--bg-hover)', border:'1px solid #4338ca44', borderRadius:12, marginBottom:18, overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', background:'#1e1b4b44', display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:13, fontWeight:700, color:'#818cf8' }}>🔍 Resultados en bitácoras</span>
                <span style={{ fontSize:12, color:'#4338ca', background:'#1e1b4b', border:'1px solid #4338ca', borderRadius:20, padding:'1px 8px' }}>
                  {filteredProjectNotes.length + Object.values(matchingComments).flat().length} resultado{(filteredProjectNotes.length + Object.values(matchingComments).flat().length)!==1?'s':''}
                </span>
              </div>
              {filteredProjectNotes.map(note => (
                <div key={`pnote-${note.id}`} style={{ padding:'10px 16px', borderBottom:'1px solid #1e293b22', display:'flex', alignItems:'flex-start', gap:12 }}>
                  <div style={{ flexShrink:0, marginTop:2 }}><div style={{ width:8, height:8, borderRadius:'50%', background:note.projectColor }} /></div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:3, display:'flex', gap:8, alignItems:'center' }}>
                      <span style={{ color:note.projectColor, fontWeight:600 }}>📁 {note.projectName}</span>
                      <span>·</span><span style={{ background:'#1e1b4b', color:'#818cf8', padding:'1px 7px', borderRadius:10, fontSize:10 }}>Bitácora de proyecto</span>
                      <span>·</span><span>{note.author||'—'}</span>
                    </div>
                    <div style={{ fontSize:13, color:'var(--text-content)', lineHeight:1.5 }}>{note.text}</div>
                  </div>
                  <button onClick={() => { setCollapsedProjects(c=>({...c,[note.projectId]:false})); setExpandedNotes(n=>({...n,[note.projectId]:true})); setTimeout(()=>{ const el=document.getElementById('project-'+note.projectId); if(el) el.scrollIntoView({behavior:'smooth',block:'start'}) },100) }} style={{ ...S.btnSecondary, padding:'4px 10px', fontSize:11, flexShrink:0 }}>Ver proyecto ↓</button>
                </div>
              ))}
              {Object.entries(matchingComments).map(([taskId, comments]) => {
                const task = proj.allTasks.find(t => t.id===parseInt(taskId))
                if (!task) return null
                return comments.map(c => (
                  <div key={`tcomm-${c.id}`} style={{ padding:'10px 16px', borderBottom:'1px solid #1e293b22', display:'flex', alignItems:'flex-start', gap:12 }}>
                    <div style={{ flexShrink:0, marginTop:2 }}><div style={{ width:8, height:8, borderRadius:'50%', background:task.projectColor }} /></div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:3, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                        <span style={{ color:task.projectColor, fontWeight:600 }}>📁 {task.projectName}</span>
                        <span>›</span><span style={{ color:'var(--text-secondary)', fontWeight:600 }}>📌 {task.title}</span>
                        <span>·</span><span style={{ background:'#0f2a1e', color:'#4ade80', padding:'1px 7px', borderRadius:10, fontSize:10 }}>Bitácora de tarea</span>
                        <span>·</span><span>{c.author||'—'}</span>
                      </div>
                      <div style={{ fontSize:13, color:'var(--text-content)', lineHeight:1.5 }}>{c.text}</div>
                    </div>
                    <button onClick={() => { setCollapsedProjects(c=>({...c,[task.projectId]:false})); setExpanded(parseInt(taskId)); setTimeout(()=>{ const el=document.getElementById('task-'+taskId); if(el) el.scrollIntoView({behavior:'smooth',block:'center'}) },100) }} style={{ ...S.btnSecondary, padding:'4px 10px', fontSize:11, flexShrink:0 }}>Ver tarea ↓</button>
                  </div>
                ))
              })}
            </div>
          )}

          {/* Proyectos */}
          {proj.sortedProjects.map(project => {
            if (filterProject!=='all' && project.id!==parseInt(filterProject)) return null
            const ptasks = filtered.filter(t => t.projectId===project.id)
            if (filterStatus!=='all' && ptasks.length===0) return null
            if (search.trim() && ptasks.length===0 && !(project.notes||[]).some(n=>n.text.toLowerCase().includes(search.toLowerCase()))) return null
            return (
              <ProjectCard
                key={project.id}
                project={project}
                filteredTasks={ptasks}
                collapsed={collapsedProjects[project.id]}
                onToggleCollapse={id => setCollapsedProjects(c=>({...c,[id]:!c[id]}))}
                expanded={expanded}
                onExpand={setExpanded}
                onToggleTask={proj.doToggle}
                showNotes={filterStatus === 'all'}
                newTaskFor={newTaskFor}
                onOpenNewTask={id => { setNewTaskFor(id); if(id) setNewTask({ title:'', responsible:'', due_date:'' }) }}
                newTask={newTask}
                onNewTaskChange={setNewTask}
                onAddTask={pId => proj.doAddTask(pId, newTask).then(() => { setNewTask({ title:'', responsible:'', due_date:'' }); setNewTaskFor(null) })}
                newProjNote={newProjNote}
                onNewProjNoteChange={(key, val) => setNewProjNote(n => ({ ...n, [key]: val }))}
                onAddProjectNote={pId => proj.doAddProjectNote(pId, newProjNote[pId]||'').then(() => setNewProjNote(n=>({...n,[pId]:'',(pId+'_open'):false})))}
                onEditProject={setEditProject}
                onDeleteProject={pId => proj.doDeleteProject(pId)}
                onArchiveProject={pId => proj.doArchiveProject(pId)}
                onMembersModal={id => { setMembersModal(id); setMemberSearch(''); setMemberResults([]) }}
                onEditTask={(pId, task) => setEditTask({ pId, task })}
                onDeleteTask={proj.doDeleteTask}
                onEditComment={(pId, tId, comment) => setEditComment({ pId, tId, comment })}
                onDeleteComment={proj.doDeleteComment}
                onMoveComment={(comment, pId, tId) => setMoveComment({ comment, pId, tId })}
                onMoveNote={(note, pId) => setMoveNote({ note, pId })}
                onAddComment={proj.doAddComment}
                newComment={newComment}
                onNewCommentChange={(tId, val) => setNewComment(p=>({...p,[tId]:val}))}
                onEditNote={(pId, note) => setEditNote({ pId, note })}
                onDeleteNote={proj.doDeleteProjectNote}
                onConfirm={(msg, action, opts) => showConfirm(msg, action, opts)}
              />
            )
          })}

          {/* Completadas */}
          {showDone && doneTasks.length > 0 && (
            <div style={{ background:'#052e16', border:'1px solid #16a34a44', borderRadius:14, padding:18 }}>
              <div style={{ fontWeight:700, color:'#22c55e', marginBottom:4 }}>✅ Archivo — completadas</div>
              <div style={{ fontSize:12, color:'#4ade80', marginBottom:10 }}>{doneTasks.length} tarea(s) completada(s)</div>
              {doneTasks.map(t => (
                <div key={t.id} style={{ background:'#0a3d1f', borderRadius:8, padding:'9px 14px', marginBottom:5, display:'flex', gap:10, fontSize:13, alignItems:'center' }}>
                  <span style={{ color:'#22c55e' }}>✓</span>
                  <span style={{ color:'#4ade80', textDecoration:'line-through', flex:1 }}>{t.title}</span>
                  <span style={{ color:'#166534', fontSize:11 }}>{t.projectName}{t.responsible?` · ${t.responsible}`:''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
