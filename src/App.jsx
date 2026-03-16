import { useState, useMemo, useEffect } from 'react'
import { api, isNetworkError } from './hooks/useApi.js'
import { useProjects } from './hooks/useProjects.js'
import { useToast } from './hooks/useToast.js'
import Toast from './components/Toast.jsx'
import { getStatus, STATUS, COLORS, S, fmtDate, exportExcel } from './utils/helpers.js'
import AuthScreen    from './components/AuthScreen.jsx'
import ProfileScreen from './components/ProfileScreen.jsx'
import Header        from './components/Header.jsx'
import ProjectCard   from './components/ProjectCard.jsx'
import { Confirm, EditProject, EditTask, EditComment, EditDueDateModal, EditCreatedAtModal, MoveNoteModal, MoveCommentModal } from './components/Modals.jsx'

export default function App() {

  // ── 1. useState — todos primero ──────────────────────────────
  const [currentUser,        setCurrentUser]        = useState(() => { try { return JSON.parse(localStorage.getItem('ft_user')) } catch { return null } })
  const [theme,              setTheme]              = useState(() => localStorage.getItem('ft_theme') || 'dark')
  const [search,             setSearch]             = useState('')
  const [filterStatus,       setFilterStatus]       = useState('all')
  const [filterProject,      setFilterProject]      = useState('all')
  const [filterDateFrom,     setFilterDateFrom]     = useState('')
  const [filterDateTo,       setFilterDateTo]       = useState('')
  const [showDone,           setShowDone]           = useState(false)
  const [viewMode,           setViewMode]           = useState('projects') // 'projects' | 'tasks' | 'bitacoras'
  const [expanded,           setExpanded]           = useState(null)
  const [expandedNotes,      setExpandedNotes]      = useState({})
  const [collapsedProjects,  setCollapsedProjects]  = useState({})
  const [newComment,         setNewComment]         = useState({})
  const [newProjNote,        setNewProjNote]        = useState({})
  const [newTaskFor,         setNewTaskFor]         = useState(null)
  const [newTask,            setNewTask]            = useState({ title:'', responsible:'', due_date:'' })
  const [newProjOpen,        setNewProjOpen]        = useState(false)
  const [newProjName,        setNewProjName]        = useState('')
  const [newProjColor,       setNewProjColor]       = useState('#22c55e')
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
  const [editDueDate,        setEditDueDate]        = useState(null) // { pId, task }
  const [editCreatedAt,      setEditCreatedAt]      = useState(null) // { type:'task'|'comment'|'note', pId, tId, item }
  const [confirm,            setConfirm]            = useState(null)
  const [moveNote,           setMoveNote]           = useState(null)
  const [moveComment,        setMoveComment]        = useState(null)

  // ── 2. Custom hooks ───────────────────────────────────────────
  const proj                         = useProjects()
  const { toasts, toast, dismiss }   = useToast()
  const errMsg = (e) => isNetworkError(e) || e?.message==='SIN_CONEXION'
    ? '⚠️ Sin conexión con la base de datos. La información no fue guardada.'
    : 'Error al guardar. Intentá nuevamente.'

  // ── 3. Funciones síncronas ────────────────────────────────────
  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  const doLogout = () => {
    localStorage.removeItem('ft_token')
    localStorage.removeItem('ft_user')
    localStorage.removeItem('ft_login_time')
    document.body.classList.remove('light')
    setCurrentUser(null)
  }

  // ── 4. useEffect ──────────────────────────────────────────────
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

  useEffect(() => { proj.loadProjects() }, [])

  useEffect(() => {
    if (!restoreMsg) return
    if (restoreMsg.ok) toast(restoreMsg.text.replace('✅ ',''), 'success', 5000)
    else toast(restoreMsg.text.replace('❌ ',''), 'error', 5000)
  }, [restoreMsg])

  useEffect(() => {
    if (!currentUser) return
    const INACTIVITY_MS = 20 * 60 * 1000 // 20 minutos
    let timer

    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(() => { doLogout(); window.location.reload() }, INACTIVITY_MS)
    }

    const EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']
    EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }))
    reset() // arrancar el timer

    return () => {
      clearTimeout(timer)
      EVENTS.forEach(e => window.removeEventListener(e, reset))
    }
  }, [currentUser])

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
      (!filterDateFrom || (t.due_date && String(t.due_date).slice(0,10) >= filterDateFrom)) &&
      (!filterDateTo   || (t.due_date && String(t.due_date).slice(0,10) <= filterDateTo))
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
      const hits = t.comments.filter(c => {
        if (!c.text.toLowerCase().includes(q) && !(c.author||'').toLowerCase().includes(q)) return false
        if (filterDateFrom && String(c.created_at).slice(0,10) < filterDateFrom) return false
        if (filterDateTo   && String(c.created_at).slice(0,10) > filterDateTo)   return false
        return true
      })
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
      <img src="/logo.png" alt="Cursor" style={{ width:80, height:80, borderRadius:20, objectFit:'cover', boxShadow:'0 0 40px #A8D17055' }} />
      <div style={{ fontSize:20, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.5px' }}>Cursor</div>
      <div style={{ fontSize:13, color:'var(--text-muted)' }}>Conectando con la base de datos...</div>
      <div style={{ width:160, height:4, background:'var(--bg-elevated)', borderRadius:999, overflow:'hidden', marginTop:4 }}>
        <div style={{ width:'40%', height:'100%', background:'var(--btn-primary)', borderRadius:999, animation:'flowbar 1.2s ease-in-out infinite' }} />
      </div>
    </div>
  )

  if (proj.error) return (
    <div style={{ minHeight:'100vh', background:'var(--bg-base)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16, color:'var(--text-primary)', fontFamily:'sans-serif', padding:24, textAlign:'center' }}>
      <div style={{ fontSize:40 }}>⚠️</div>
      <div style={{ fontSize:18, fontWeight:700 }}>Error de conexión</div>
      <div style={{ color:'var(--text-secondary)', maxWidth:400, lineHeight:1.6 }}>{proj.error}</div>
      <button onClick={proj.loadProjects} style={{ background:'var(--btn-primary)', border:'none', color:'var(--btn-primary-text)', padding:'10px 24px', borderRadius:8, cursor:'pointer', fontSize:14 }}>Reintentar</button>
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
                      <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--btn-primary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'var(--btn-primary-text)' }}>{m.name.charAt(0).toUpperCase()}</div>
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
              <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:12 }}>Seleccioná un archivo .json generado por Cursor.</div>
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
      {editProject && <EditProject project={editProject} onSave={(name,color) => { proj.doSaveEditProject(editProject,name,color).then(()=>toast('Proyecto actualizado')).catch(e=>toast(errMsg(e),'error')); setEditProject(null) }} onClose={()=>setEditProject(null)} />}
      {editTask    && <EditTask task={editTask.task} onSave={form => { proj.doSaveEditTask(editTask.pId,editTask.task.id,form).then(()=>toast('Tarea actualizada')).catch(e=>toast(errMsg(e),'error')); setEditTask(null) }} onClose={()=>setEditTask(null)} />}
      {editComment && <EditComment comment={editComment.comment} onSave={data => { proj.doSaveEditComment(editComment.pId,editComment.tId,editComment.comment.id,data).then(()=>toast('Nota actualizada')).catch(e=>toast(errMsg(e),'error')); setEditComment(null) }} onClose={()=>setEditComment(null)} />}
      {editNote    && <EditComment comment={editNote.note}       onSave={data => { proj.doSaveEditNote(editNote.pId,editNote.note.id,data).then(()=>toast('Nota actualizada')).catch(e=>toast(errMsg(e),'error')); setEditNote(null) }}           onClose={()=>setEditNote(null)} />}
      {editDueDate && <EditDueDateModal task={editDueDate.task} onSave={due_date => { proj.doSaveEditTask(editDueDate.pId,editDueDate.task.id,{title:editDueDate.task.title,responsible:editDueDate.task.responsible||'',due_date}).then(()=>toast('Fecha actualizada')).catch(e=>toast(errMsg(e),'error')); setEditDueDate(null) }} onClose={()=>setEditDueDate(null)} />}
      {editCreatedAt && editCreatedAt.type==='task'    && <EditCreatedAtModal item={editCreatedAt.item} label={editCreatedAt.item.title} onSave={d => { proj.doSaveEditTask(editCreatedAt.pId,editCreatedAt.item.id,{title:editCreatedAt.item.title,responsible:editCreatedAt.item.responsible||'',due_date:editCreatedAt.item.due_date||'',created_at:d}).then(()=>toast('Fecha actualizada')).catch(e=>toast(errMsg(e),'error')); setEditCreatedAt(null) }} onClose={()=>setEditCreatedAt(null)} />}
      {editCreatedAt && editCreatedAt.type==='comment' && <EditCreatedAtModal item={editCreatedAt.item} label={editCreatedAt.item.text?.slice(0,60)} onSave={d => { proj.doSaveEditComment(editCreatedAt.pId,editCreatedAt.tId,editCreatedAt.item.id,{text:editCreatedAt.item.text,created_at:d}).then(()=>toast('Fecha actualizada')).catch(e=>toast(errMsg(e),'error')); setEditCreatedAt(null) }} onClose={()=>setEditCreatedAt(null)} />}
      {editCreatedAt && editCreatedAt.type==='note'    && <EditCreatedAtModal item={editCreatedAt.item} label={editCreatedAt.item.text?.slice(0,60)} onSave={d => { proj.doSaveEditNote(editCreatedAt.pId,editCreatedAt.item.id,{text:editCreatedAt.item.text,created_at:d}).then(()=>toast('Fecha actualizada')).catch(e=>toast(errMsg(e),'error')); setEditCreatedAt(null) }} onClose={()=>setEditCreatedAt(null)} />}
      {moveNote    && <MoveNoteModal note={moveNote.note} tasks={proj.allTasks.filter(t=>!t.done)} onMove={taskId => { proj.doMoveNoteToTask(moveNote.note,moveNote.pId,taskId,proj.allTasks).then(()=>toast('Nota movida a tarea')).catch(e=>toast(errMsg(e),'error')); setMoveNote(null) }} onClose={()=>setMoveNote(null)} />}
      {moveComment && <MoveCommentModal comment={moveComment.comment} projects={proj.projects} currentProjectId={moveComment.pId} onMove={projectId => { proj.doMoveCommentToProject(moveComment.comment,moveComment.pId,moveComment.tId,projectId).then(()=>toast('Nota movida al proyecto')).catch(e=>toast(errMsg(e),'error')); setMoveComment(null) }} onClose={()=>setMoveComment(null)} />}

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
                  <button onClick={() => showConfirm(`¿Eliminar "${project.name}" y TODAS sus tareas y notas? Esta acción no se puede deshacer.`, () => proj.doDeleteProject(project.id).then(()=>toast('Proyecto eliminado')).catch(e=>toast(errMsg(e),'error')))} style={{ ...S.iconBtn, borderColor:'#dc262633', color:'#ef4444' }} title="Eliminar permanentemente">🗑</button>
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

              <select value={filterProject} onChange={e=>setFilterProject(e.target.value)} style={{ ...S.select, flex:'1 1 150px' }}>
                <option value="all">Todos los proyectos</option>
                {[...proj.projects].sort((a,b) => a.name.localeCompare(b.name, 'es', {sensitivity:'base'})).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <label style={{ display:'flex', alignItems:'center', gap:7, fontSize:13, cursor:'pointer', whiteSpace:'nowrap' }}>
                <input type="checkbox" checked={showDone} onChange={e=>setShowDone(e.target.checked)} style={{ accentColor:'#A8D170' }} /> Mostrar completadas
              </label>
              <div style={{ display:'flex', gap:6, marginLeft:'auto' }}>
                {[{id:'projects',label:'🗂 Proyectos'},{id:'tasks',label:'📋 Tareas'},{id:'bitacoras',label:'💬 Bitácoras'}].map(v => (
                  <button key={v.id} onClick={()=>setViewMode(v.id)} style={{ ...S.btnSecondary, padding:'5px 12px', fontSize:12, fontWeight: viewMode===v.id?700:400, border: viewMode===v.id?'1.5px solid var(--accent)':'1px solid var(--border-soft)', color: viewMode===v.id?'var(--accent)':'var(--text-secondary)' }}>{v.label}</button>
                ))}
              </div>
            </div>
            <div className="ft-filters" style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
              <span style={{ fontSize:12, color:'var(--text-muted)', whiteSpace:'nowrap' }}>📅 Filtrar por fecha de registro:</span>
              <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--text-secondary)' }}>Desde <input type="date" value={filterDateFrom} onChange={e=>setFilterDateFrom(e.target.value)} style={{ ...S.input, padding:'5px 8px', fontSize:12 }} /></label>
              <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--text-secondary)' }}>Hasta <input type="date" value={filterDateTo}   onChange={e=>setFilterDateTo(e.target.value)}   style={{ ...S.input, padding:'5px 8px', fontSize:12 }} /></label>
              {(filterDateFrom||filterDateTo) && <button onClick={()=>{setFilterDateFrom('');setFilterDateTo('')}} style={{ ...S.btnSecondary, padding:'5px 10px', fontSize:12 }}>✕ Limpiar fechas</button>}
            </div>
          </div>

          {/* Stats — botones filtrables */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))', gap:10, marginBottom:18 }}>
            {[
              { label:'Total',       val:proj.allTasks.length,                                                    color:'#A8D170', filter:null },
              { label:'Por vencer',  val:proj.allTasks.filter(t=>getStatus(t.due_date,t.done)==='warning').length, color:'#f59e0b', filter:'warning' },
              { label:'Vencidas',    val:proj.allTasks.filter(t=>getStatus(t.due_date,t.done)==='overdue').length, color:'#ef4444', filter:'overdue' },
              { label:'Completadas', val:doneTasks.length,                                                         color:'#22c55e', filter:'done' },
              { label:'Proyectos',   val:proj.projects.length,                                                     color:'#7BC6D9', filter:'__projects__' },
            ].map(s => {
              const active = s.filter === null ? filterStatus === 'all' : filterStatus === s.filter
              return (
                <button
                  key={s.label}
                  onClick={() => {
                    if (s.filter === '__projects__') return
                    if (s.filter === 'done') {
                      if (active) { setShowDone(false); setFilterStatus('all') }
                      else { setShowDone(true); setFilterStatus('done') }
                    } else {
                      setFilterStatus(active && s.filter !== null ? 'all' : (s.filter || 'all'))
                    }
                  }}
                  style={{ background:'var(--bg-surface)', border:`1.5px solid ${active ? s.color : s.color+'44'}`, borderRadius:10, padding:'12px 14px', textAlign:'center', cursor: s.filter === '__projects__' ? 'default' : 'pointer', outline:'none', transition:'all .15s', boxShadow: active && s.filter !== null ? `0 0 0 2px ${s.color}44` : 'none' }}
                >
                  <div style={{ fontSize:24, fontWeight:800, color:s.color }}>{s.val}</div>
                  <div style={{ fontSize:11, color: active && s.filter !== null ? s.color : 'var(--text-muted)', marginTop:2, fontWeight: active && s.filter !== null ? 700 : 400 }}>{s.label}</div>
                </button>
              )
            })}
          </div>

          {/* Colapsar / Expandir todos */}
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:10 }}>
            <button
              onClick={() => {
                const allCollapsed = proj.sortedProjects.every(p => collapsedProjects[p.id])
                const next = {}
                if (!allCollapsed) proj.sortedProjects.forEach(p => { next[p.id] = true })
                setCollapsedProjects(next)
              }}
              style={{ ...S.btnSecondary, padding:'5px 12px', fontSize:12, display:'flex', alignItems:'center', gap:5 }}
            >
              {proj.sortedProjects.every(p => collapsedProjects[p.id]) ? '▼ Expandir todos' : '▲ Colapsar todos'}
            </button>
          </div>

          {/* Nuevo proyecto */}
          {newProjOpen && (
            <div style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-soft)', borderRadius:12, padding:14, marginBottom:16, display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
              <input placeholder="Nombre del proyecto..." value={newProjName} onChange={e=>setNewProjName(e.target.value)}
                onKeyDown={e => {
                if (e.key==='Enter' && newProjName.trim()) {
                  proj.doAddProject(newProjName, newProjColor).then(() => { setNewProjName(''); setNewProjOpen(false); toast('Proyecto creado') }).catch(e => toast(errMsg(e),'error'))
                }
              }}
                style={{ ...S.input, flex:1 }} autoFocus />
              <div style={{ display:'flex', gap:6 }}>
                {COLORS.map(c => <div key={c} onClick={() => setNewProjColor(c)} style={{ width:22, height:22, borderRadius:'50%', background:c, cursor:'pointer', border:newProjColor===c?'3px solid white':'3px solid transparent', boxSizing:'border-box' }} />)}
              </div>
              <button onClick={() => { proj.doAddProject(newProjName,newProjColor).then(()=>{ setNewProjName(''); setNewProjOpen(false); toast('Proyecto creado') }).catch(e=>toast(errMsg(e),'error')) }} style={S.btnPrimary}>Crear</button>
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
          {/* Vista Tareas */}
          {viewMode === 'tasks' && (() => {
            const allTasks = [...proj.allTasks]
              .filter(t => !t.done || showDone)
              .filter(t => filterProject==='all' || t.projectId===parseInt(filterProject))
              .filter(t => !search.trim() || t.title.toLowerCase().includes(search.toLowerCase()) || t.projectName.toLowerCase().includes(search.toLowerCase()) || (t.responsible||'').toLowerCase().includes(search.toLowerCase()))
              .sort((a,b) => {
                const stA = getStatus(a.due_date, a.done), stB = getStatus(b.due_date, b.done)
                const order = {overdue:0, warning:1, ok:2, done:3}
                if (order[stA] !== order[stB]) return order[stA] - order[stB]
                if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
                if (a.due_date) return -1
                if (b.due_date) return 1
                return 0
              })
            return (
              <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
                <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', background:'var(--bg-elevated)', fontWeight:700, fontSize:13 }}>📋 Listado de tareas — {allTasks.length} resultado{allTasks.length!==1?'s':''}</div>
                {allTasks.length === 0 && <div style={{ padding:24, textAlign:'center', color:'var(--text-faint)', fontSize:13 }}>Sin tareas.</div>}
                {allTasks.map(t => {
                  const cfg = STATUS[getStatus(t.due_date, t.done)]
                  return (
                    <div key={t.id} style={{ padding:'10px 16px', borderBottom:'1px solid var(--border)', borderLeft:`3px solid ${cfg.border}`, display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:18, height:18, borderRadius:4, border:`2px solid ${cfg.badge}`, background:t.done?cfg.badge:'transparent', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'#0f172a', fontWeight:900, flexShrink:0 }}>{t.done&&'✓'}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:600, fontSize:13, color:t.done?'var(--text-faint)':(getStatus(t.due_date,t.done)==='overdue'?'#ef4444':getStatus(t.due_date,t.done)==='warning'?'#f59e0b':'var(--task-title)'), wordBreak:'break-word', overflowWrap:'break-word' }}>{t.title}</div>
                        <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2, display:'flex', gap:8, flexWrap:'wrap' }}>
                          <span style={{ color:t.projectColor, fontWeight:600 }}>📁 {t.projectName}</span>
                          {t.responsible && <span>👤 {t.responsible}</span>}
                          {t.due_date && <span>📅 {t.due_date.slice(0,10)}</span>}
                        </div>
                      </div>
                      <div style={{ background:`${cfg.badge}22`, border:`1px solid ${cfg.badge}55`, color:cfg.badge, padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600, whiteSpace:'nowrap', flexShrink:0 }}>● {cfg.label}</div>
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {/* Vista Bitácoras */}
          {viewMode === 'bitacoras' && (() => {
            const allNotes = [
              ...proj.projects
                .filter(p => filterProject==='all' || p.id===parseInt(filterProject))
                .flatMap(p => (p.notes||[]).map(n => ({ ...n, _kind:'proyecto', projectName:p.name, projectColor:p.color, taskTitle:null }))),
              ...proj.allTasks
                .filter(t => filterProject==='all' || t.projectId===parseInt(filterProject))
                .flatMap(t => t.comments.map(c => ({ ...c, _kind:'tarea', projectName:t.projectName, projectColor:t.projectColor, taskTitle:t.title })))
            ]
            .filter(n => !search.trim() || n.text.toLowerCase().includes(search.toLowerCase()) || n.projectName.toLowerCase().includes(search.toLowerCase()) || (n.taskTitle||'').toLowerCase().includes(search.toLowerCase()))
            .sort((a,b) => (b.created_at||'') > (a.created_at||'') ? 1 : -1)
            return (
              <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
                <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', background:'var(--bg-elevated)', fontWeight:700, fontSize:13 }}>💬 Listado de bitácoras — {allNotes.length} resultado{allNotes.length!==1?'s':''}</div>
                {allNotes.length === 0 && <div style={{ padding:24, textAlign:'center', color:'var(--text-faint)', fontSize:13 }}>Sin bitácoras.</div>}
                {allNotes.map((n,i) => (
                  <div key={i} style={{ padding:'10px 16px', borderBottom:'1px solid var(--border)', borderLeft:`3px solid ${n.projectColor}`, display:'flex', alignItems:'flex-start', gap:10 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4, display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                        <span style={{ color:n.projectColor, fontWeight:600 }}>📁 {n.projectName}</span>
                        {n.taskTitle && <><span>›</span><span style={{ color:'var(--text-secondary)', fontWeight:600 }}>📌 {n.taskTitle}</span></>}
                        <span style={{ background: n._kind==='tarea'?'#0f2a1e':'#1e1b4b', color: n._kind==='tarea'?'#4ade80':'#818cf8', padding:'1px 7px', borderRadius:10, fontSize:10 }}>{n._kind==='tarea'?'Bitácora de tarea':'Bitácora de proyecto'}</span>
                        <span>·</span><span>{n.author||'—'}</span><span>·</span><span>{fmtDate(n.created_at)}</span>
                      </div>
                      <div style={{ fontSize:13, color:'var(--text-content)', lineHeight:1.5 }}>{n.text}</div>
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Proyectos */}
          {viewMode === 'projects' && proj.sortedProjects.map(project => {
            if (filterProject!=='all' && project.id!==parseInt(filterProject)) return null
            const ptasks = filtered.filter(t => t.projectId===project.id)
            if (filterStatus!=='all' && ptasks.length===0) return null
            // Filtrar notas del proyecto por fecha de registro
            const filteredNotes = (project.notes||[]).filter(n => {
              const d = String(n.created_at||'').slice(0,10)
              if (filterDateFrom && d < filterDateFrom) return false
              if (filterDateTo   && d > filterDateTo)   return false
              return true
            })
            // Filtrar bitácoras de tareas por fecha de registro
            const projectWithFilteredNotes = {
              ...project,
              notes: filteredNotes,
              tasks: project.tasks.map(t => ({
                ...t,
                comments: t.comments.filter(c => {
                  const d = String(c.created_at||'').slice(0,10)
                  if (filterDateFrom && d < filterDateFrom) return false
                  if (filterDateTo   && d > filterDateTo)   return false
                  return true
                })
              }))
            }
            if (search.trim() && ptasks.length===0 && !filteredNotes.some(n=>n.text.toLowerCase().includes(search.toLowerCase()))) return null
            return (
              <ProjectCard
                key={project.id}
                project={projectWithFilteredNotes}
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
                onAddTask={pId => {
                  const { due_day, due_month, due_year, ...rest } = newTask
                  const builtDue = (due_day && due_month)
                    ? (due_year||String(new Date().getFullYear())) + '-' + String(due_month).padStart(2,'0') + '-' + String(due_day).padStart(2,'0')
                    : ''
                  const taskData = { ...rest, due_date: builtDue }
                  setNewTask({ title:'', responsible:'', due_date:'', due_day:'', due_month:'', due_year:'' })
                  setNewTaskFor(null)
                  proj.doAddTask(pId, taskData)
                    .then(() => toast('Tarea agregada'))
                    .catch(e => toast(errMsg(e),'error'))
                }}
                newProjNote={newProjNote}
                onNewProjNoteChange={(key, val) => setNewProjNote(n => ({ ...n, [key]: val }))}
                onAddProjectNote={pId => {
                  proj.doAddProjectNote(pId, newProjNote[pId]||'')
                    .then(() => { setNewProjNote(n => ({ ...n, [pId]:'', [pId+'_open']:false })); toast('Nota agregada') })
                    .catch(e => toast(errMsg(e),'error'))
                }}
                onEditProject={setEditProject}
                onDeleteProject={pId => proj.doDeleteProject(pId).then(()=>toast('Proyecto eliminado')).catch(e=>toast(errMsg(e),'error'))}
                onArchiveProject={pId => proj.doArchiveProject(pId).then(()=>toast('Proyecto archivado','warning')).catch(e=>toast(errMsg(e),'error'))}
                onMembersModal={id => { setMembersModal(id); setMemberSearch(''); setMemberResults([]) }}
                onEditTask={(pId, task) => setEditTask({ pId, task })}
                onEditDueDate={(pId, task) => setEditDueDate({ pId, task })}
                onEditCreatedAt={(type, pId, tId, item) => setEditCreatedAt({ type, pId, tId, item })}
                onDeleteTask={proj.doDeleteTask}
                onEditComment={(pId, tId, comment) => setEditComment({ pId, tId, comment })}
                onDeleteComment={proj.doDeleteComment}
                onMoveComment={(comment, pId, tId) => setMoveComment({ comment, pId, tId })}
                onMoveNote={(note, pId) => setMoveNote({ note, pId })}
                onAddComment={(pId, tId, text) => { setNewComment(p=>({...p,[tId]:''})); proj.doAddComment(pId, tId, text).then(() => toast('Nota agregada')).catch(e => { setNewComment(p=>({...p,[tId]:text})); toast(errMsg(e),'error') }) }}
                newComment={newComment}
                onNewCommentChange={(tId, val) => setNewComment(p=>({...p,[tId]:val}))}
                onEditNote={(pId, note) => setEditNote({ pId, note })}
                onDeleteNote={proj.doDeleteProjectNote}
                onConfirm={(msg, action, opts) => showConfirm(msg, action, opts)}
              />
            )
          })}

          {/* Completadas — solo en vista proyectos */}
          {viewMode === 'projects' && showDone && doneTasks.length > 0 && (
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
      <Toast toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
