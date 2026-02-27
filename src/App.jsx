import { useState, useMemo, useEffect, useCallback } from 'react'
import { api } from './hooks/useApi.js'
import AuthScreen from './components/AuthScreen.jsx'
import ProfileScreen from './components/ProfileScreen.jsx'
import { Confirm, EditProject, EditTask, EditComment, MoveNoteModal, MoveCommentModal } from './components/Modals.jsx'

// ── Helpers ──────────────────────────────────────────────────────
const getStatus = (due, done) => {
  if (done) return 'done'
  if (!due) return 'ok'
  const dueStr = String(due).slice(0, 10)  // normalizar a YYYY-MM-DD
  const today = new Date()
  const todayStr = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0')
  if (dueStr < todayStr) return 'overdue'
  const diff = (new Date(dueStr + 'T12:00:00') - new Date(todayStr + 'T12:00:00')) / 86400000
  if (diff <= 3) return 'warning'
  return 'ok'
}

const STATUS = {
  done:    { bg:'#052e16', border:'#16a34a', badge:'#22c55e', label:'Completada' },
  overdue: { bg:'#2d0a0a', border:'#dc2626', badge:'#ef4444', label:'Vencida'    },
  warning: { bg:'#2d1f00', border:'#d97706', badge:'#f59e0b', label:'Por vencer' },
  ok:      { bg:'#0f172a', border:'#334155', badge:'#64748b', label:'Sin vencer' },
}

const COLORS = ['#6366f1','#8b5cf6','#ec4899','#14b8a6','#f97316','#06b6d4','#f59e0b','#22c55e']

// Convierte fecha UTC de la BD a hora Argentina (UTC-3) para mostrar
// Formatea datetime completo → fecha y hora en Argentina (UTC-3)
const fmtDate = d => {
  if (!d) return ''
  if (d.includes(' ') || d.includes('T')) {
    const date = new Date(d.replace(' ', 'T') + (d.includes('Z') ? '' : 'Z'))
    date.setHours(date.getHours() - 3)
    return date.toISOString().slice(0, 16).replace('T', ' ')
  }
  return d
}

// Formatea solo fecha (DATE de PostgreSQL puede venir como ISO string)
const fmtSimpleDate = d => {
  if (!d) return ''
  // Extraer solo YYYY-MM-DD sin importar el formato
  return String(d).slice(0, 10)
}

// ── Styles ────────────────────────────────────────────────────────
const S = {
  input:  { background:'var(--bg-elevated)', border:'1px solid var(--border-soft)', color:'var(--text-primary)', padding:'8px 12px', borderRadius:8, fontSize:13, outline:'none', boxSizing:'border-box' },
  select: { background:'var(--bg-elevated)', border:'1px solid var(--border-soft)', color:'var(--text-primary)', padding:'8px 12px', borderRadius:8, fontSize:13, outline:'none', cursor:'pointer' },
  btnPrimary:   { background:'linear-gradient(135deg,#6366f1,#8b5cf6)', border:'none', color:'white', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600, whiteSpace:'nowrap' },
  btnSecondary: { background:'var(--bg-elevated)', border:'1px solid var(--border-soft)', color:'var(--text-secondary)', padding:'8px 14px', borderRadius:8, cursor:'pointer', fontSize:13, whiteSpace:'nowrap' },
  iconBtn: { background:'transparent', border:'1px solid var(--border-soft)', color:'var(--text-secondary)', width:28, height:28, borderRadius:6, cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', padding:0, flexShrink:0 },
}

// ── Excel export (sin librería externa) ──────────────────────────
function exportExcel(projects) {
  // Genera un XML de Excel básico (formato SpreadsheetML)
  const esc = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
  const cell = (v, type='String') => `<Cell><Data ss:Type="${type}">${esc(v)}</Data></Cell>`
  const row  = cells => `<Row>${cells.join('')}</Row>`

  const sheets = []

  // Hoja Proyectos
  const projRows = [
    row([cell('ID'),cell('Nombre'),cell('Color'),cell('Fecha creación'),cell('Tareas totales'),cell('Completadas'),cell('Notas')]),
    ...projects.map(p => row([
      cell(p.id,'Number'), cell(p.name), cell(p.color), cell(fmtDate(p.created_at)),
      cell(p.tasks.length,'Number'), cell(p.tasks.filter(t=>t.done).length,'Number'),
      cell(p.notes?.length||0,'Number')
    ]))
  ]
  sheets.push(`<Worksheet ss:Name="Proyectos"><Table>${projRows.join('')}</Table></Worksheet>`)

  // Hoja Tareas
  const taskRows = [
    row([cell('ID'),cell('Proyecto'),cell('Título'),cell('Responsable'),cell('Fecha registro'),cell('Vencimiento'),cell('Estado'),cell('Completada'),cell('Fecha completado'),cell('Comentarios')]),
    ...projects.flatMap(p => p.tasks.map(t => row([
      cell(t.id,'Number'), cell(p.name), cell(t.title), cell(t.responsible||''),
      cell(fmtDate(t.created_at)), cell(fmtSimpleDate(t.due_date)),
      cell(STATUS[getStatus(t.due_date,t.done)].label),
      cell(t.done?'Sí':'No'), cell(t.done_at||''),
      cell(t.comments.length,'Number')
    ])))
  ]
  sheets.push(`<Worksheet ss:Name="Tareas"><Table>${taskRows.join('')}</Table></Worksheet>`)

  // Hoja Notas de Proyecto
  const noteRows = [
    row([cell('ID'),cell('Proyecto'),cell('Autor'),cell('Fecha'),cell('Nota')]),
    ...projects.flatMap(p => (p.notes||[]).map(n => row([
      cell(n.id,'Number'), cell(p.name), cell(n.author||''), cell(fmtDate(n.created_at)), cell(n.text)
    ])))
  ]
  sheets.push(`<Worksheet ss:Name="Notas de Proyecto"><Table>${noteRows.join('')}</Table></Worksheet>`)

  // Hoja Comentarios de Tareas
  const commRows = [
    row([cell('ID'),cell('Proyecto'),cell('Tarea'),cell('Autor'),cell('Fecha'),cell('Comentario')]),
    ...projects.flatMap(p => p.tasks.flatMap(t => t.comments.map(c => row([
      cell(c.id,'Number'), cell(p.name), cell(t.title), cell(c.author||''), cell(fmtDate(c.created_at)), cell(c.text)
    ]))))
  ]
  sheets.push(`<Worksheet ss:Name="Comentarios"><Table>${commRows.join('')}</Table></Worksheet>`)

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles><Style ss:ID="Default"><Font ss:Bold="0"/></Style></Styles>
  ${sheets.join('\n')}
</Workbook>`

  const blob = new Blob([xml], { type:'application/vnd.ms-excel;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `FlowTracker_${new Date().toISOString().split('T')[0]}.xls`
  a.click()
  URL.revokeObjectURL(a.href)
}

// ════════════════════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════════════════════
export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('ft_theme') || 'dark')

  useEffect(() => {
    // Solo aplicar modo claro si hay usuario logueado, login siempre oscuro
    const hasUser = !!localStorage.getItem('ft_token')
    document.body.classList.toggle('light', theme === 'light' && hasUser)
    localStorage.setItem('ft_theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ft_user')) } catch { return null }
  })
  const [membersModal, setMembersModal]     = useState(null) // projectId
  const [userMenuOpen, setUserMenuOpen]     = useState(false)
  const [mobileSubMenu, setMobileSubMenu]   = useState(false)
  const [profileOpen, setProfileOpen]       = useState(false)
  const [memberSearch, setMemberSearch]     = useState('')
  const [memberResults, setMemberResults]   = useState([])
  const [projects, setProjects]             = useState([])
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState(null)
  const [search, setSearch]                 = useState('')
  const [filterStatus, setFilterStatus]     = useState('all')
  const [filterProject, setFilterProject]   = useState('all')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo]     = useState('')
  const [showDone, setShowDone]             = useState(false)
  const [expanded, setExpanded]             = useState(null)        // task comments
  const [expandedNotes, setExpandedNotes]   = useState({})          // project notes per project
  const [collapsedProjects, setCollapsedProjects] = useState({})   // collapsed task list per project
  const [newComment, setNewComment]         = useState({})
  const [newProjNote, setNewProjNote]       = useState({})
  const [newTaskFor, setNewTaskFor]         = useState(null)
  const [newTask, setNewTask]               = useState({ title:'', responsible:'', due_date:'' })
  const [newProjOpen, setNewProjOpen]       = useState(false)
  const [newProjName, setNewProjName]       = useState('')
  const [newProjColor, setNewProjColor]     = useState('#6366f1')
  const [archiveView, setArchiveView]       = useState(false)
  const [backupModal, setBackupModal]       = useState(false)
  const [restoring, setRestoring]           = useState(false)
  const [restoreMsg, setRestoreMsg]         = useState(null)
  const [archivedProjects, setArchivedProjects] = useState([])
  const [loadingArchived, setLoadingArchived]   = useState(false)
  const [editProject, setEditProject]       = useState(null)
  const [editTask, setEditTask]             = useState(null)
  const [editComment, setEditComment]       = useState(null)
  const [editNote, setEditNote]             = useState(null)
  const [confirm, setConfirm]               = useState(null)
  const [moveNote, setMoveNote]             = useState(null)        // { note, projectId }
  const [moveComment, setMoveComment]       = useState(null)        // { comment, projectId, taskId }

  // ── Load ─────────────────────────────────────────────────────
  const loadProjects = useCallback(async () => {
    if (!localStorage.getItem('ft_token')) { setLoading(false); return }
    try {
      setLoading(true); setError(null)
      setProjects(await api.getProjects())
    } catch(e) {
      setError('No se pudo conectar con el servidor. ¿Está corriendo? (npm run dev)')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadProjects() }, [loadProjects])

  // Escuchar evento de sesión expirada desde useApi
  useEffect(() => {
    const handler = () => setCurrentUser(null)
    window.addEventListener('ft_logout', handler)
    return () => window.removeEventListener('ft_logout', handler)
  }, [])

  // ── Computed ─────────────────────────────────────────────────
  const allTasks = useMemo(() =>
    projects.flatMap(p => p.tasks.map(t => ({ ...t, projectId:p.id, projectName:p.name, projectColor:p.color }))),
    [projects])

  const filtered = useMemo(() => allTasks.filter(t => {
    const st = getStatus(t.due_date, t.done)
    const q  = search.toLowerCase()
    const matchSearch = !q ||
      t.title.toLowerCase().includes(q) ||
      t.projectName.toLowerCase().includes(q) ||
      (t.responsible||'').toLowerCase().includes(q) ||
      t.comments.some(c => c.text.toLowerCase().includes(q) || (c.author||'').toLowerCase().includes(q))
    const matchStatus   = filterStatus==='all' || st===filterStatus
    const matchProject  = filterProject==='all' || t.projectId===parseInt(filterProject)
    const matchDone     = showDone || !t.done
    const matchDateFrom = !filterDateFrom || (t.created_at && t.created_at >= filterDateFrom)
    const matchDateTo   = !filterDateTo   || (t.created_at && t.created_at <= filterDateTo + 'T99')
    return matchSearch && matchStatus && matchProject && matchDone && matchDateFrom && matchDateTo
  }), [allTasks, search, filterStatus, filterProject, showDone, filterDateFrom, filterDateTo])

  // Notas de proyecto que coinciden con la búsqueda (respeta filtros)
  const filteredProjectNotes = useMemo(() => {
    if (!search.trim()) return []
    const q = search.toLowerCase()
    return projects
      .filter(p => filterProject==='all' || p.id===parseInt(filterProject))
      .flatMap(p => (p.notes||[])
        .filter(n => {
          if (!n.text.toLowerCase().includes(q) && !(n.author||'').toLowerCase().includes(q)) return false
          if (filterDateFrom && n.created_at && String(n.created_at).slice(0,10) < filterDateFrom) return false
          if (filterDateTo   && n.created_at && String(n.created_at).slice(0,10) > filterDateTo) return false
          return true
        })
        .map(n => ({ ...n, projectId:p.id, projectName:p.name, projectColor:p.color }))
      )
  }, [projects, search, filterProject, filterDateFrom, filterDateTo])

  // Para cada tarea en resultados: qué comentarios matchean la búsqueda (respeta filtros)
  const matchingComments = useMemo(() => {
    if (!search.trim()) return {}
    const q = search.toLowerCase()
    const result = {}
    allTasks.forEach(t => {
      // Respetar filtro de proyecto
      if (filterProject!=='all' && t.projectId!==parseInt(filterProject)) return
      // Respetar filtro de fechas
      if (filterDateFrom && t.created_at && t.created_at < filterDateFrom) return
      if (filterDateTo   && t.created_at && t.created_at > filterDateTo + 'T99') return
      const hits = t.comments.filter(c => c.text.toLowerCase().includes(q) || (c.author||'').toLowerCase().includes(q))
      if (hits.length) result[t.id] = hits
    })
    return result
  }, [allTasks, search, filterProject, filterDateFrom, filterDateTo])

  // Ordenar proyectos: primero los que tienen tareas vencidas
  const sortedProjects = useMemo(() => [...projects].sort((a, b) => {
    const hasOverdueA = a.tasks.some(t => getStatus(t.due_date, t.done) === 'overdue')
    const hasOverdueB = b.tasks.some(t => getStatus(t.due_date, t.done) === 'overdue')
    if (hasOverdueA && !hasOverdueB) return -1
    if (!hasOverdueA && hasOverdueB) return 1
    return b.name.localeCompare(a.name, 'es', { sensitivity: 'base' })
  }), [projects])

  const doneTasks = allTasks.filter(t => t.done)

  // ── Mutators ─────────────────────────────────────────────────
  const mutTask = (pId, tId, fn) =>
    setProjects(prev => prev.map(p => p.id===pId ? { ...p, tasks:p.tasks.map(t => t.id===tId ? fn(t) : t) } : p))

  // Projects
  const doSaveEditProject = async (name, color) => {
    const updated = await api.updateProject(editProject.id, name, color)
    setProjects(prev => prev.map(p => p.id===editProject.id ? { ...p, name:updated.name, color:updated.color } : p))
    setEditProject(null)
  }

  const doAddProject = async () => {
    if (!newProjName.trim()) return
    const project = await api.createProject(newProjName, newProjColor)
    setProjects(prev => [...prev, project])
    setNewProjName(''); setNewProjOpen(false)
  }

  const doDeleteProject = async pId => {
    await api.deleteProject(pId)
    setProjects(prev => prev.filter(p => p.id !== pId))
  }

  const doBackup = async () => {
    const BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'
    const res  = await fetch(`${BASE}/backup`)
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `flowtracker_backup_${new Date().toISOString().slice(0,10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const doRestore = async file => {
    if (!file) return
    setRestoring(true)
    setRestoreMsg(null)
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'
      const res  = await fetch(`${BASE}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json)
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)
      setRestoreMsg({ ok: true, text: `✅ Restauración exitosa: ${result.restored.projects} proyectos, ${result.restored.tasks} tareas, ${result.restored.task_comments} comentarios, ${result.restored.project_notes} notas.` })
      await loadProjects()
    } catch(e) {
      setRestoreMsg({ ok: false, text: `❌ Error: ${e.message}` })
    } finally {
      setRestoring(false)
    }
  }

  const doLogout = () => {
    localStorage.removeItem('ft_token')
    localStorage.removeItem('ft_user')
    localStorage.removeItem('ft_login_time')
    document.body.classList.remove('light')
    setCurrentUser(null)
  }

  // ── Auto-logout por expiración de sesión ─────────────────────
  useEffect(() => {
    if (!currentUser) return

    const SESSION_MS = 90 * 60 * 1000 // 90 minutos
    const loginTime  = parseInt(localStorage.getItem('ft_login_time') || '0')
    const remaining  = SESSION_MS - (Date.now() - loginTime)

    if (remaining <= 0) {
      doLogout()
      return
    }

    const timer = setTimeout(() => {
      doLogout()
      alert('Tu sesión expiró. Por favor iniciá sesión nuevamente.')
    }, remaining)

    const handleFocus = () => {
      const elapsed = Date.now() - parseInt(localStorage.getItem('ft_login_time') || '0')
      if (elapsed >= SESSION_MS) doLogout()
    }
    window.addEventListener('focus', handleFocus)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('focus', handleFocus)
    }
  }, [currentUser])

  const doSearchMembers = async q => {
    setMemberSearch(q)
    if (q.length < 2) { setMemberResults([]); return }
    try {
      const results = await api.searchUsers(q)
      // Filtrar los que ya son miembros
      const project = projects.find(p => p.id === membersModal)
      const memberIds = (project?.members||[]).map(m => m.id)
      setMemberResults(results.filter(u => !memberIds.includes(u.id)))
    } catch(e) {}
  }

  const doAddMember = async userId => {
    const updated = await api.addMember(membersModal, userId)
    setProjects(prev => prev.map(p => p.id === membersModal ? updated : p))
    setMemberResults(prev => prev.filter(u => u.id !== userId))
  }

  const doRemoveMember = async (projectId, userId) => {
    const updated = await api.removeMember(projectId, userId)
    setProjects(prev => prev.map(p => p.id === projectId ? updated : p))
  }

  const doArchiveProject = async pId => {
    await api.archiveProject(pId)
    setProjects(prev => prev.filter(p => p.id !== pId))
  }

  const doUnarchiveProject = async pId => {
    const project = await api.unarchiveProject(pId)
    setArchivedProjects(prev => prev.filter(p => p.id !== pId))
    setProjects(prev => [...prev, project])
  }

  const loadArchived = async () => {
    setLoadingArchived(true)
    try {
      const data = await api.getArchivedProjects()
      setArchivedProjects(data)
    } finally {
      setLoadingArchived(false)
    }
  }

  // Tasks
  const doToggle = async id => {
    const updated = await api.toggleTask(id)
    setProjects(prev => prev.map(p => ({
      ...p, tasks: p.tasks.map(t => t.id===id ? { ...t, ...updated } : t)
    })))
  }

  const doAddTask = async projectId => {
    if (!newTask.title) return
    const task = await api.createTask({ project_id:projectId, ...newTask })
    setProjects(prev => prev.map(p => p.id===projectId ? { ...p, tasks:[...p.tasks, task] } : p))
    setNewTask({ title:'', responsible:'', due_date:'' }); setNewTaskFor(null)
  }

  const doSaveEditTask = async form => {
    const updated = await api.updateTask(editTask.task.id, form)
    mutTask(editTask.pId, editTask.task.id, t => ({ ...t, ...updated }))
    setEditTask(null)
  }

  const doDeleteTask = async (pId, tId) => {
    await api.deleteTask(tId)
    setProjects(prev => prev.map(p => p.id===pId ? { ...p, tasks:p.tasks.filter(t => t.id!==tId) } : p))
  }

  // Task comments
  const doAddComment = async (pId, tId) => {
    const text = (newComment[tId]||'').trim(); if (!text) return
    const comment = await api.createComment({ task_id:tId, text })
    mutTask(pId, tId, t => ({ ...t, comments:[...t.comments, comment] }))
    setNewComment(p => ({ ...p, [tId]:'' }))
  }

  const doSaveEditComment = async text => {
    const { pId, tId, comment } = editComment
    const updated = await api.updateComment(comment.id, text)
    mutTask(pId, tId, t => ({ ...t, comments:t.comments.map(c => c.id===updated.id ? updated : c) }))
    setEditComment(null)
  }

  const doDeleteComment = async (pId, tId, cId) => {
    await api.deleteComment(cId)
    mutTask(pId, tId, t => ({ ...t, comments:t.comments.filter(c => c.id!==cId) }))
  }

  // Move comment → project note
  const doMoveCommentToProject = async projectId => {
    const { comment, pId, tId } = moveComment
    const result = await api.moveCommentToProject(comment.id, projectId)
    // Eliminar de la tarea
    mutTask(pId, tId, t => ({ ...t, comments:t.comments.filter(c => c.id!==result.deletedCommentId) }))
    // Agregar a las notas del proyecto destino
    setProjects(prev => prev.map(p => p.id===projectId
      ? { ...p, notes:[...(p.notes||[]), result.note] } : p))
    setMoveComment(null)
  }

  // Project notes
  const doAddProjectNote = async pId => {
    const text = (newProjNote[pId]||'').trim(); if (!text) return
    const note = await api.createProjectNote({ project_id:pId, text })
    setProjects(prev => prev.map(p => p.id===pId ? { ...p, notes:[...(p.notes||[]), note] } : p))
    setNewProjNote(n => ({ ...n, [pId]:'' }))
  }

  const doSaveEditNote = async text => {
    const { pId, note } = editNote
    const updated = await api.updateProjectNote(note.id, text)
    setProjects(prev => prev.map(p => p.id===pId
      ? { ...p, notes:(p.notes||[]).map(n => n.id===updated.id ? updated : n) } : p))
    setEditNote(null)
  }

  const doDeleteProjectNote = async (pId, nId) => {
    await api.deleteProjectNote(nId)
    setProjects(prev => prev.map(p => p.id===pId
      ? { ...p, notes:(p.notes||[]).filter(n => n.id!==nId) } : p))
  }

  // Move note → task comment
  const doMoveNoteToTask = async taskId => {
    const { note, pId } = moveNote
    const result = await api.moveNoteToTask(note.id, taskId)
    // Eliminar nota del proyecto
    setProjects(prev => prev.map(p => p.id===pId
      ? { ...p, notes:(p.notes||[]).filter(n => n.id!==result.deletedNoteId) } : p))
    // Agregar comentario a la tarea correspondiente
    const task = allTasks.find(t => t.id===taskId)
    if (task) mutTask(task.projectId, taskId, t => ({ ...t, comments:[...t.comments, result.comment] }))
    setMoveNote(null)
  }

  // ── Auth guard ───────────────────────────────────────────────────
  if (!currentUser) return <AuthScreen onAuth={user => {
    localStorage.setItem('ft_login_time', Date.now().toString())
    setCurrentUser(user)
    document.body.classList.toggle('light', (localStorage.getItem('ft_theme') || 'dark') === 'light')
    loadProjects()
  }} />

  // ── Loading / Error ───────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight:'100vh', background:'var(--splash-bg)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:20, fontFamily:'sans-serif' }}>
      <style>{`
        @keyframes flowbar {
          0%   { transform: translateX(-100%) }
          100% { transform: translateX(400%) }
        }
        @keyframes bounceDot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.3 }
          40%            { transform: scale(1.2); opacity: 1   }
        }
      `}</style>
      <img src="/logo.png" alt="FlowTracker" style={{ width:80,height:80,borderRadius:20,objectFit:'cover',boxShadow:'0 0 40px #6366f155' }} />
      <div style={{ fontSize:20,fontWeight:700,color:'var(--text-primary)',letterSpacing:'-0.5px' }}>FlowTracker</div>
      <div style={{ fontSize:13,color:'var(--text-muted)' }}>Conectando con la base de datos...</div>
      <div style={{ width:160,height:4,background:'var(--bg-elevated)',borderRadius:999,overflow:'hidden',marginTop:4 }}>
        <div style={{ width:'40%',height:'100%',background:'linear-gradient(90deg,#6366f1,#8b5cf6)',borderRadius:999,animation:'flowbar 1.2s ease-in-out infinite' }} />
      </div>
    </div>
  )

  if (error) return (
    <div style={{ minHeight:'100vh', background:'var(--bg-base)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16, color:'var(--text-primary)', fontFamily:'sans-serif', padding:24, textAlign:'center' }}>
      <div style={{ fontSize:40 }}>⚠️</div>
      <div style={{ fontSize:18, fontWeight:700 }}>Error de conexión</div>
      <div style={{ color:'var(--text-secondary)', maxWidth:400, lineHeight:1.6 }}>{error}</div>
      <button onClick={loadProjects} style={{ background:'#6366f1', border:'none', color:'white', padding:'10px 24px', borderRadius:8, cursor:'pointer', fontSize:14 }}>Reintentar</button>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-base)', fontFamily:"'DM Sans','Segoe UI',sans-serif", color:'var(--text-primary)' }}>

      {/* MODALS */}
      {profileOpen && (
        <ProfileScreen
          user={currentUser}
          onSave={user => { setCurrentUser(user); setProfileOpen(false) }}
          onClose={()=>setProfileOpen(false)}
        />
      )}
      {membersModal && (() => {
        const project = projects.find(p => p.id === membersModal)
        if (!project) return null
        return (
          <div onClick={()=>setMembersModal(null)} style={{ position:'fixed',inset:0,background:'#000b',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center' }}>
            <div onClick={e=>e.stopPropagation()} style={{ background:'var(--bg-surface)',border:'1px solid var(--border-soft)',borderRadius:14,padding:28,width:'100%',maxWidth:460,boxShadow:'0 30px 80px #0009' }}>
              <div style={{ fontSize:16,fontWeight:700,marginBottom:4 }}>👥 Miembros del proyecto</div>
              <div style={{ fontSize:13,color:'var(--text-muted)',marginBottom:20 }}>{project.name}</div>

              {/* Lista de miembros actuales */}
              <div style={{ marginBottom:16 }}>
                {(project.members||[]).map(m => (
                  <div key={m.id} style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px',background:'var(--bg-elevated)',borderRadius:8,marginBottom:6 }}>
                    <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                      <div style={{ width:28,height:28,borderRadius:'50%',background:'linear-gradient(135deg,#6366f1,#8b5cf6)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'white' }}>
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize:13,color:'var(--text-primary)' }}>{m.name}</div>
                        <div style={{ fontSize:11,color:'var(--text-faint)' }}>{m.email}</div>
                      </div>
                    </div>
                    <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                      <span style={{ fontSize:11,color: m.role==='owner'?'#f59e0b':'#64748b',background: m.role==='owner'?'#451a03':'#1e293b',border:`1px solid ${m.role==='owner'?'#92400e':'#334155'}`,padding:'2px 8px',borderRadius:10 }}>
                        {m.role==='owner'?'Propietario':'Miembro'}
                      </span>
                      {m.role !== 'owner' && m.id !== currentUser.id && (
                        <button onClick={()=>doRemoveMember(project.id, m.id)} style={{ background:'transparent',border:'1px solid #dc262633',color:'#ef4444',borderRadius:6,padding:'3px 8px',cursor:'pointer',fontSize:12 }}>✕</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Buscar y agregar miembro */}
              <div style={{ borderTop:'1px solid var(--border)',paddingTop:16 }}>
                <div style={{ fontSize:13,fontWeight:600,color:'var(--text-secondary)',marginBottom:8 }}>Agregar miembro</div>
                <input
                  placeholder="Buscar por nombre o email..."
                  value={memberSearch}
                  onChange={e=>doSearchMembers(e.target.value)}
                  style={{ background:'var(--bg-elevated)',border:'1px solid var(--border-soft)',color:'var(--text-primary)',padding:'8px 12px',borderRadius:8,fontSize:13,outline:'none',width:'100%',boxSizing:'border-box',marginBottom:8 }}
                />
                {memberResults.map(u => (
                  <div key={u.id} style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px',background:'var(--bg-elevated)',borderRadius:8,marginBottom:6 }}>
                    <div>
                      <div style={{ fontSize:13,color:'var(--text-primary)' }}>{u.name}</div>
                      <div style={{ fontSize:11,color:'var(--text-faint)' }}>{u.email}</div>
                    </div>
                    <button onClick={()=>doAddMember(u.id)} style={{ background:'#065f46',border:'1px solid #059669',color:'#34d399',padding:'5px 12px',borderRadius:7,cursor:'pointer',fontSize:12,fontWeight:600 }}>+ Agregar</button>
                  </div>
                ))}
                {memberSearch.length >= 2 && memberResults.length === 0 && (
                  <div style={{ fontSize:13,color:'var(--text-faint)',textAlign:'center',padding:'8px 0' }}>No se encontraron usuarios</div>
                )}
              </div>

              <div style={{ display:'flex',justifyContent:'flex-end',marginTop:16 }}>
                <button onClick={()=>setMembersModal(null)} style={{ background:'var(--bg-elevated)',border:'1px solid var(--border-soft)',color:'var(--text-secondary)',padding:'8px 18px',borderRadius:8,cursor:'pointer',fontSize:13 }}>Cerrar</button>
              </div>
            </div>
          </div>
        )
      })()}
      {backupModal && (
        <div onClick={()=>setBackupModal(false)} style={{ position:'fixed',inset:0,background:'#000b',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center' }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'var(--bg-surface)',border:'1px solid var(--border-soft)',borderRadius:14,padding:28,width:'100%',maxWidth:460,boxShadow:'0 30px 80px #0009' }}>
            <div style={{ fontSize:16,fontWeight:700,marginBottom:6 }}>💾 Backup y Restauración</div>
            <div style={{ fontSize:13,color:'var(--text-muted)',marginBottom:24 }}>Descargá un backup completo o restaurá desde un archivo previo.</div>

            {/* Descargar */}
            <div style={{ background:'var(--bg-hover)',border:'1px solid var(--border)',borderRadius:10,padding:16,marginBottom:12 }}>
              <div style={{ fontSize:13,fontWeight:600,color:'var(--text-primary)',marginBottom:4 }}>⬇ Descargar backup</div>
              <div style={{ fontSize:12,color:'var(--text-muted)',marginBottom:12 }}>Exporta todos los proyectos, tareas, notas y bitácoras en un archivo JSON.</div>
              <button onClick={doBackup} style={{ background:'#065f46',border:'1px solid #059669',color:'#34d399',padding:'8px 18px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600 }}>
                ⬇ Descargar backup
              </button>
            </div>

            {/* Restaurar */}
            <div style={{ background:'var(--bg-hover)',border:'1px solid var(--border)',borderRadius:10,padding:16,marginBottom:16 }}>
              <div style={{ fontSize:13,fontWeight:600,color:'var(--text-primary)',marginBottom:4 }}>⬆ Restaurar desde backup</div>
              <div style={{ fontSize:12,color:'var(--text-secondary)',marginBottom:4 }}>⚠ Esto <strong>reemplaza todos los datos actuales</strong> con los del archivo.</div>
              <div style={{ fontSize:12,color:'var(--text-muted)',marginBottom:12 }}>Seleccioná un archivo .json generado por FlowTracker.</div>
              <label style={{ display:'inline-block',background:'#7c3aed',border:'none',color:'white',padding:'8px 18px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600 }}>
                {restoring ? '⏳ Restaurando...' : '⬆ Seleccionar archivo'}
                <input type="file" accept=".json" disabled={restoring} onChange={e=>doRestore(e.target.files[0])} style={{ display:'none' }} />
              </label>
              {restoreMsg && (
                <div style={{ marginTop:12,fontSize:13,color: restoreMsg.ok ? '#34d399':'#ef4444',background: restoreMsg.ok?'#052e16':'#2d0a0a',border:`1px solid ${restoreMsg.ok?'#16a34a':'#dc2626'}`,borderRadius:8,padding:'10px 14px',lineHeight:1.5 }}>
                  {restoreMsg.text}
                </div>
              )}
            </div>

            <div style={{ display:'flex',justifyContent:'flex-end' }}>
              <button onClick={()=>setBackupModal(false)} style={{ background:'var(--bg-elevated)',border:'1px solid var(--border-soft)',color:'var(--text-secondary)',padding:'8px 18px',borderRadius:8,cursor:'pointer',fontSize:13 }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
      {confirm      && <Confirm msg={confirm.msg} onOk={()=>{confirm.action();setConfirm(null)}} onCancel={()=>setConfirm(null)} title={confirm.title} okLabel={confirm.okLabel} okColor={confirm.okColor} />}
      {editProject  && <EditProject project={editProject} onSave={doSaveEditProject} onClose={()=>setEditProject(null)} />}
      {editTask     && <EditTask task={editTask.task} onSave={doSaveEditTask} onClose={()=>setEditTask(null)} />}
      {editComment  && <EditComment comment={editComment.comment} onSave={doSaveEditComment} onClose={()=>setEditComment(null)} />}
      {editNote     && <EditComment comment={editNote.note} onSave={doSaveEditNote} onClose={()=>setEditNote(null)} />}
      {moveNote     && <MoveNoteModal note={moveNote.note} tasks={allTasks.filter(t=>!t.done)} onMove={doMoveNoteToTask} onClose={()=>setMoveNote(null)} />}
      {moveComment  && <MoveCommentModal comment={moveComment.comment} projects={projects} currentProjectId={moveComment.pId} onMove={doMoveCommentToProject} onClose={()=>setMoveComment(null)} />}

      {/* HEADER */}
      <div className="ft-header" style={{ background:'var(--header-bg)', borderBottom:'1px solid var(--border)', padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100, gap:10 }}>
        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <img src="/logo.png" alt="FlowTracker" style={{ width:34,height:34,borderRadius:8,objectFit:'cover' }} />
          <div>
            <div style={{ fontSize:17,fontWeight:700,letterSpacing:'-0.5px' }}>FlowTracker</div>
            <div className="ft-header-sub" style={{ fontSize:10,color:'var(--text-muted)' }}><span style={{color:'#22c55e'}}>● PostgreSQL</span> · Datos persistentes en la nube</div>
          </div>
        </div>

        {/* DESKTOP: botones normales */}
        <div className="hide-mobile" style={{ display:'flex',gap:8,alignItems:'center',flexWrap:'wrap' }}>
          {!archiveView && (
            <button onClick={()=>exportExcel(projects)} style={{ background:'#065f46',border:'1px solid #059669',color:'#34d399',padding:'8px 16px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600 }}>
              ⬇ Exportar Excel
            </button>
          )}
          <button onClick={()=>{ if(!archiveView){ loadArchived() } setArchiveView(v=>!v) }}
            style={{ background:archiveView?'#78350f':'var(--bg-elevated)',border:`1px solid ${archiveView?'#d97706':'var(--border-soft)'}`,color:archiveView?'#fbbf24':'var(--text-secondary)',padding:'8px 16px',borderRadius:8,cursor:'pointer',fontSize:13 }}>
            {archiveView?'← Volver':'📦 Archivados'}
          </button>
          {!archiveView && (
            <button onClick={()=>{ setBackupModal(true); setRestoreMsg(null) }}
              style={{ background:'var(--bg-elevated)',border:'1px solid var(--border-soft)',color:'var(--text-secondary)',padding:'8px 16px',borderRadius:8,cursor:'pointer',fontSize:13 }}>
              💾 Backup
            </button>
          )}
          {!archiveView && <button onClick={()=>setNewProjOpen(true)} style={S.btnPrimary}>+ Nuevo Proyecto</button>}
          {/* Avatar + menú usuario desktop */}
          <div style={{ position:'relative',borderLeft:'1px solid var(--border)',paddingLeft:12,marginLeft:4 }}>
            <button onClick={()=>setUserMenuOpen(v=>!v)}
              style={{ display:'flex',alignItems:'center',gap:8,background:'transparent',border:'none',cursor:'pointer',padding:'4px 6px',borderRadius:8 }}>
              <div style={{ width:30,height:30,borderRadius:'50%',background:'linear-gradient(135deg,#6366f1,#8b5cf6)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'white',flexShrink:0 }}>
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize:13,color:'var(--text-secondary)',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{currentUser.name}</span>
              <span style={{ fontSize:10,color:'var(--text-faint)' }}>▾</span>
            </button>
            {userMenuOpen && (
              <>
                <div onClick={()=>{ setUserMenuOpen(false); setMobileSubMenu(false) }} style={{ position:'fixed',inset:0,zIndex:150 }} />
                <div style={{ position:'absolute',right:0,top:'calc(100% + 8px)',background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:10,minWidth:200,boxShadow:'0 10px 40px #00000088',zIndex:200,overflow:'hidden' }}>
                  <div style={{ padding:'12px 16px',borderBottom:'1px solid var(--border)' }}>
                    <div style={{ fontSize:13,fontWeight:600,color:'var(--text-primary)' }}>{currentUser.name}</div>
                    <div style={{ fontSize:11,color:'var(--text-faint)',marginTop:2 }}>@{currentUser.username||currentUser.email}</div>
                  </div>
                  <button onClick={()=>{ toggleTheme(); setUserMenuOpen(false) }}
                    style={{ width:'100%',background:'transparent',border:'none',color:'var(--text-secondary)',padding:'10px 16px',cursor:'pointer',fontSize:13,textAlign:'left',display:'flex',alignItems:'center',gap:10 }}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--bg-elevated)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    {theme === 'dark' ? '☀️ Modo claro' : '🌙 Modo oscuro'}
                  </button>
                  <button onClick={()=>{ setUserMenuOpen(false); setProfileOpen(true) }}
                    style={{ width:'100%',background:'transparent',border:'none',color:'var(--text-secondary)',padding:'10px 16px',cursor:'pointer',fontSize:13,textAlign:'left',display:'flex',alignItems:'center',gap:10 }}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--bg-elevated)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    ✏️ Editar perfil
                  </button>
                  <button onClick={()=>{ setUserMenuOpen(false); doLogout() }}
                    style={{ width:'100%',background:'transparent',border:'none',color:'#ef4444',padding:'10px 16px',cursor:'pointer',fontSize:13,textAlign:'left',display:'flex',alignItems:'center',gap:10,borderTop:'1px solid var(--border)' }}
                    onMouseEnter={e=>e.currentTarget.style.background='#2d0a0a'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    ⎋ Cerrar sesión
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* MOBILE: Nuevo Proyecto + Hamburguesa */}
        <div className="mobile-only" style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          {!archiveView && <button onClick={()=>setNewProjOpen(true)} style={{ ...S.btnPrimary, padding:'8px 12px', fontSize:12 }}>+ Proyecto</button>}
          {archiveView && (
            <button onClick={()=>setArchiveView(false)}
              style={{ background:'#78350f',border:'1px solid #d97706',color:'#fbbf24',padding:'8px 12px',borderRadius:8,cursor:'pointer',fontSize:12 }}>
              ← Volver
            </button>
          )}
          <button onClick={()=>setUserMenuOpen(v=>!v)}
            style={{ background:'var(--bg-elevated)',border:'1px solid var(--border-soft)',color:'var(--text-secondary)',width:38,height:38,borderRadius:8,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:4,flexShrink:0,padding:0 }}>
            <span style={{ display:'block',width:16,height:2,background:'currentColor',borderRadius:2 }}/>
            <span style={{ display:'block',width:16,height:2,background:'currentColor',borderRadius:2 }}/>
            <span style={{ display:'block',width:16,height:2,background:'currentColor',borderRadius:2 }}/>
          </button>
        </div>

        {/* Menú hamburguesa MOBILE */}
        {userMenuOpen && (
          <>
            <div onClick={()=>{ setUserMenuOpen(false); setMobileSubMenu(false) }} style={{ position:'fixed',inset:0,zIndex:150 }} />
            <div style={{ position:'fixed',right:12,top:64,background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:12,width:240,maxWidth:'calc(100vw - 24px)',boxShadow:'0 10px 40px #00000099',zIndex:200,display:'block',overflowY:'auto',maxHeight:'calc(100vh - 80px)' }}>

              {/* Fila usuario → abre submenu */}
              <button onClick={()=>setMobileSubMenu(v=>!v)}
                style={{ width:'100%',background:'transparent',border:'none',borderBottom:'1px solid var(--border)',padding:'13px 16px',cursor:'pointer',display:'flex',alignItems:'center',gap:10,textAlign:'left' }}>
                <div style={{ width:32,height:32,borderRadius:'50%',background:'linear-gradient(135deg,#6366f1,#8b5cf6)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'white',flexShrink:0 }}>
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13,fontWeight:600,color:'var(--text-primary)' }}>{currentUser.name}</div>
                  <div style={{ fontSize:11,color:'var(--text-faint)' }}>@{currentUser.username||currentUser.email}</div>
                </div>
                <span style={{ fontSize:11,color:'var(--text-faint)' }}>{mobileSubMenu ? '▲' : '▶'}</span>
              </button>

              {/* Submenu usuario */}
              {mobileSubMenu && (
                <div style={{ background:'var(--bg-hover)',borderBottom:'1px solid var(--border)' }}>
                  <button onClick={()=>{ toggleTheme(); setUserMenuOpen(false); setMobileSubMenu(false) }}
                    style={{ width:'100%',background:'transparent',border:'none',color:'var(--text-secondary)',padding:'10px 16px 10px 26px',cursor:'pointer',fontSize:13,textAlign:'left',display:'flex',alignItems:'center',gap:10 }}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--bg-elevated)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    {theme === 'dark' ? '☀️ Modo claro' : '🌙 Modo oscuro'}
                  </button>
                  <button onClick={()=>{ setUserMenuOpen(false); setMobileSubMenu(false); setProfileOpen(true) }}
                    style={{ width:'100%',background:'transparent',border:'none',color:'var(--text-secondary)',padding:'10px 16px 10px 26px',cursor:'pointer',fontSize:13,textAlign:'left',display:'flex',alignItems:'center',gap:10 }}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--bg-elevated)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    ✏️ Editar perfil
                  </button>
                  <button onClick={()=>{ setUserMenuOpen(false); setMobileSubMenu(false); doLogout() }}
                    style={{ width:'100%',background:'transparent',border:'none',color:'#ef4444',padding:'10px 16px 10px 26px',cursor:'pointer',fontSize:13,textAlign:'left',display:'flex',alignItems:'center',gap:10 }}
                    onMouseEnter={e=>e.currentTarget.style.background='#2d0a0a'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    ⎋ Cerrar sesión
                  </button>
                </div>
              )}

              {/* Opciones generales */}
              {!archiveView && (
                <button onClick={()=>{ exportExcel(projects); setUserMenuOpen(false) }}
                  style={{ width:'100%',background:'transparent',border:'none',color:'#34d399',padding:'12px 16px',cursor:'pointer',fontSize:13,textAlign:'left',display:'flex',alignItems:'center',gap:10,borderBottom:'1px solid var(--border)' }}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--bg-elevated)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  ⬇ Exportar Excel
                </button>
              )}
              <button onClick={()=>{ if(!archiveView){ loadArchived() } setArchiveView(v=>!v); setUserMenuOpen(false) }}
                style={{ width:'100%',background:'transparent',border:'none',color:'#fbbf24',padding:'12px 16px',cursor:'pointer',fontSize:13,textAlign:'left',display:'flex',alignItems:'center',gap:10,borderBottom:'1px solid var(--border)' }}
                onMouseEnter={e=>e.currentTarget.style.background='var(--bg-elevated)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                📦 {archiveView ? 'Volver a proyectos' : 'Archivados'}
              </button>
              {!archiveView && (
                <button onClick={()=>{ setBackupModal(true); setRestoreMsg(null); setUserMenuOpen(false) }}
                  style={{ width:'100%',background:'transparent',border:'none',color:'var(--text-secondary)',padding:'12px 16px',cursor:'pointer',fontSize:13,textAlign:'left',display:'flex',alignItems:'center',gap:10 }}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--bg-elevated)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  💾 Backup y restauración
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {archiveView ? (
        <div className="ft-main" style={{ maxWidth:1200,margin:'0 auto',padding:'28px 20px' }}>
          <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:20 }}>
            <span style={{ fontSize:18,fontWeight:700,color:'#fbbf24' }}>📦 Proyectos Archivados</span>
            {loadingArchived && <span style={{ fontSize:13,color:'var(--text-muted)' }}>Cargando...</span>}
            {!loadingArchived && <span style={{ fontSize:13,color:'var(--text-muted)' }}>{archivedProjects.length} proyecto{archivedProjects.length!==1?'s':''}</span>}
          </div>
          {!loadingArchived && archivedProjects.length===0 && (
            <div style={{ textAlign:'center',color:'var(--text-faint)',fontSize:14,padding:40 }}>No hay proyectos archivados.</div>
          )}
          {archivedProjects.map(project => (
            <div key={project.id} style={{ background:'var(--bg-surface)',border:'1px solid var(--border-soft)',borderRadius:14,marginBottom:12,overflow:'hidden',opacity:0.85 }}>
              <div style={{ borderLeft:`4px solid ${project.color}`,padding:'12px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',background:`linear-gradient(90deg,${project.color}11,transparent)` }}>
                <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                  <div style={{ width:9,height:9,borderRadius:'50%',background:project.color }} />
                  <span style={{ fontWeight:700,fontSize:15,color:'var(--text-secondary)' }}>{project.name}</span>
                  <span style={{ background:'var(--bg-elevated)',border:'1px solid var(--border-soft)',borderRadius:20,padding:'1px 9px',fontSize:11,color:'var(--text-faint)' }}>
                    {project.tasks.length} tarea{project.tasks.length!==1?'s':''} · {project.notes?.length||0} nota{(project.notes?.length||0)!==1?'s':''}
                  </span>
                  <span style={{ background:'#451a03',border:'1px solid #92400e',borderRadius:20,padding:'1px 9px',fontSize:11,color:'#fbbf24' }}>📦 Archivado</span>
                </div>
                <div style={{ display:'flex',gap:7 }}>
                  <button onClick={()=>setConfirm({msg:`¿Restaurar "${project.name}" a la pantalla principal?`,action:()=>doUnarchiveProject(project.id),title:'↩ Confirmar restauración',okLabel:'Restaurar',okColor:'#059669'})}
                    style={{ background:'#065f46',border:'1px solid #059669',color:'#34d399',padding:'6px 14px',borderRadius:7,cursor:'pointer',fontSize:12,fontWeight:600 }}>
                    ↩ Restaurar
                  </button>
                  <button onClick={()=>setConfirm({msg:`¿Eliminar "${project.name}" y TODAS sus tareas y notas? Esta acción no se puede deshacer.`,action:()=>doDeleteProject(project.id)})}
                    style={{ ...S.iconBtn,borderColor:'#dc262633',color:'#ef4444' }} title="Eliminar permanentemente">🗑</button>
                </div>
              </div>
              {/* Resumen de tareas archivadas */}
              <div style={{ padding:'8px 16px',fontSize:12,color:'var(--text-faint)',display:'flex',gap:16,borderTop:'1px solid var(--border)' }}>
                <span>📌 {project.tasks.filter(t=>!t.done).length} pendiente{project.tasks.filter(t=>!t.done).length!==1?'s':''}</span>
                <span>✅ {project.tasks.filter(t=>t.done).length} completada{project.tasks.filter(t=>t.done).length!==1?'s':''}</span>
                <span>📝 {project.notes?.length||0} nota{(project.notes?.length||0)!==1?'s':''}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ maxWidth:1200,margin:'0 auto',padding:'28px 20px' }}>

          {/* FILTROS */}
          <div style={{ background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:12,padding:'14px 16px',marginBottom:18 }}>
            <div className="ft-filter-row1" style={{ display:'flex',gap:10,flexWrap:'wrap',alignItems:'center',marginBottom:10 }}>
              <div className="ft-search-wrap" style={{ position:'relative', flex:'1 1 220px', display:'flex', alignItems:'center' }}>
                <input placeholder="🔍 Buscar por tarea, proyecto o responsable..." value={search} onChange={e=>setSearch(e.target.value)} style={{ ...S.input, width:'100%', paddingRight: search ? '32px' : '12px' }} />
                {search && (
                  <button onClick={()=>setSearch('')} style={{ position:'absolute',right:8,background:'none',border:'none',color:'var(--text-muted)',cursor:'pointer',fontSize:16,lineHeight:1,padding:'2px 4px',display:'flex',alignItems:'center' }} title="Limpiar búsqueda">✕</button>
                )}
              </div>
              <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{ ...S.select, flex:'1 1 150px' }}>
                <option value="all">Todos los estados</option>
                <option value="warning">Por vencer (≤3 días)</option>
                <option value="overdue">Vencidas</option>
                <option value="done">Completadas</option>
              </select>
              <select value={filterProject} onChange={e=>setFilterProject(e.target.value)} style={{ ...S.select, flex:'1 1 150px' }}>
                <option value="all">Todos los proyectos</option>
                {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <label style={{ display:'flex',alignItems:'center',gap:7,fontSize:13,cursor:'pointer',whiteSpace:'nowrap' }}>
                <input type="checkbox" checked={showDone} onChange={e=>setShowDone(e.target.checked)} style={{ accentColor:'#6366f1' }} /> Mostrar completadas
              </label>
            </div>
            {/* Filtro por fechas */}
            <div className="ft-filters" style={{ display:'flex',gap:10,flexWrap:'wrap',alignItems:'center' }}>
              <span style={{ fontSize:12,color:'var(--text-muted)',whiteSpace:'nowrap' }}>📅 Filtrar por fecha de registro:</span>
              <label style={{ display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--text-secondary)' }}>
                Desde <input type="date" value={filterDateFrom} onChange={e=>setFilterDateFrom(e.target.value)} style={{ ...S.input,padding:'5px 8px',fontSize:12 }} />
              </label>
              <label style={{ display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--text-secondary)' }}>
                Hasta <input type="date" value={filterDateTo} onChange={e=>setFilterDateTo(e.target.value)} style={{ ...S.input,padding:'5px 8px',fontSize:12 }} />
              </label>
              {(filterDateFrom||filterDateTo) && (
                <button onClick={()=>{setFilterDateFrom('');setFilterDateTo('')}} style={{ ...S.btnSecondary,padding:'5px 10px',fontSize:12 }}>✕ Limpiar fechas</button>
              )}
            </div>
          </div>

          {/* STATS */}
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))',gap:10,marginBottom:18 }}>
            {[
              {label:'Total',       val:allTasks.length,                                                  color:'#6366f1'},
              {label:'Por vencer',  val:allTasks.filter(t=>getStatus(t.due_date,t.done)==='warning').length, color:'#f59e0b'},
              {label:'Vencidas',    val:allTasks.filter(t=>getStatus(t.due_date,t.done)==='overdue').length, color:'#ef4444'},
              {label:'Completadas', val:doneTasks.length,                                                  color:'#22c55e'},
              {label:'Proyectos',   val:projects.length,                                                   color:'#8b5cf6'},
            ].map(s=>(
              <div key={s.label} style={{ background:'var(--bg-surface)',border:`1px solid ${s.color}44`,borderRadius:10,padding:'12px 14px',textAlign:'center' }}>
                <div style={{ fontSize:24,fontWeight:800,color:s.color }}>{s.val}</div>
                <div style={{ fontSize:11,color:'var(--text-muted)',marginTop:2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* NUEVO PROYECTO */}
          {newProjOpen && (
            <div style={{ background:'var(--bg-elevated)',border:'1px solid var(--border-soft)',borderRadius:12,padding:14,marginBottom:16,display:'flex',gap:10,flexWrap:'wrap',alignItems:'center' }}>
              <input placeholder="Nombre del proyecto..." value={newProjName} onChange={e=>setNewProjName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doAddProject()} style={{ ...S.input,flex:1 }} autoFocus />
              <div style={{ display:'flex',gap:6 }}>
                {COLORS.map(c=>(
                  <div key={c} onClick={()=>setNewProjColor(c)} style={{ width:22,height:22,borderRadius:'50%',background:c,cursor:'pointer',border:newProjColor===c?'3px solid white':'3px solid transparent',boxSizing:'border-box' }} />
                ))}
              </div>
              <button onClick={doAddProject} style={S.btnPrimary}>Crear</button>
              <button onClick={()=>setNewProjOpen(false)} style={S.btnSecondary}>Cancelar</button>
            </div>
          )}

          {/* RESULTADOS DE BÚSQUEDA EN BITÁCORAS */}
          {search.trim() && (filteredProjectNotes.length > 0 || Object.keys(matchingComments).length > 0) && (
            <div style={{ background:'var(--bg-hover)',border:'1px solid #4338ca44',borderRadius:12,marginBottom:18,overflow:'hidden' }}>
              <div style={{ padding:'12px 16px',borderBottom:'1px solid var(--border)',background:'#1e1b4b44',display:'flex',alignItems:'center',gap:8 }}>
                <span style={{ fontSize:13,fontWeight:700,color:'#818cf8' }}>🔍 Resultados en bitácoras</span>
                <span style={{ fontSize:12,color:'#4338ca',background:'#1e1b4b',border:'1px solid #4338ca',borderRadius:20,padding:'1px 8px' }}>
                  {filteredProjectNotes.length + Object.values(matchingComments).flat().length} resultado{(filteredProjectNotes.length + Object.values(matchingComments).flat().length)!==1?'s':''}
                </span>
              </div>

              {/* Notas de proyecto que matchean */}
              {filteredProjectNotes.map(note => (
                <div key={`pnote-${note.id}`} style={{ padding:'10px 16px',borderBottom:'1px solid #1e293b22',display:'flex',alignItems:'flex-start',gap:12 }}>
                  <div style={{ flexShrink:0,marginTop:2 }}>
                    <div style={{ width:8,height:8,borderRadius:'50%',background:note.projectColor,marginBottom:4 }} />
                  </div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:11,color:'var(--text-muted)',marginBottom:3,display:'flex',gap:8,alignItems:'center' }}>
                      <span style={{ color:note.projectColor,fontWeight:600 }}>📁 {note.projectName}</span>
                      <span>·</span>
                      <span style={{ background:'#1e1b4b',color:'#818cf8',padding:'1px 7px',borderRadius:10,fontSize:10 }}>Bitácora de proyecto</span>
                      <span>·</span>
                      <span>{note.author||'—'} · {fmtDate(note.created_at)}</span>
                    </div>
                    <div style={{ fontSize:13,color:'var(--text-content)',lineHeight:1.5 }}>{note.text}</div>
                  </div>
                  <button
                    onClick={()=>{ setCollapsedProjects(c=>({...c,[note.projectId]:false})); setExpandedNotes(n=>({...n,[note.projectId]:true})); setTimeout(()=>{ const el=document.getElementById('project-'+note.projectId); if(el) el.scrollIntoView({behavior:'smooth',block:'start'}) },100) }}
                    style={{ ...S.btnSecondary,padding:'4px 10px',fontSize:11,flexShrink:0 }}
                    title="Ir al proyecto">
                    Ver proyecto ↓
                  </button>
                </div>
              ))}

              {/* Comentarios de tareas que matchean */}
              {Object.entries(matchingComments).map(([taskId, comments]) => {
                const task = allTasks.find(t => t.id===parseInt(taskId))
                if (!task) return null
                return comments.map(c => (
                  <div key={`tcomm-${c.id}`} style={{ padding:'10px 16px',borderBottom:'1px solid #1e293b22',display:'flex',alignItems:'flex-start',gap:12 }}>
                    <div style={{ flexShrink:0,marginTop:2 }}>
                      <div style={{ width:8,height:8,borderRadius:'50%',background:task.projectColor,marginBottom:4 }} />
                    </div>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontSize:11,color:'var(--text-muted)',marginBottom:3,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap' }}>
                        <span style={{ color:task.projectColor,fontWeight:600 }}>📁 {task.projectName}</span>
                        <span>›</span>
                        <span style={{ color:'var(--text-secondary)',fontWeight:600 }}>📌 {task.title}</span>
                        <span>·</span>
                        <span style={{ background:'#0f2a1e',color:'#4ade80',padding:'1px 7px',borderRadius:10,fontSize:10 }}>Bitácora de tarea</span>
                        <span>·</span>
                        <span>{c.author||'—'} · {fmtDate(c.created_at)}</span>
                      </div>
                      <div style={{ fontSize:13,color:'var(--text-content)',lineHeight:1.5 }}>{c.text}</div>
                    </div>
                    <button
                      onClick={()=>{
                        const t = allTasks.find(t => t.id===parseInt(taskId))
                        if (t) {
                          setCollapsedProjects(c=>({...c,[t.projectId]:false}))
                          setExpanded(parseInt(taskId))
                          setTimeout(()=>{
                            const el = document.getElementById('task-'+taskId)
                            if (el) el.scrollIntoView({ behavior:'smooth', block:'center' })
                          }, 100)
                        }
                      }}
                      style={{ ...S.btnSecondary,padding:'4px 10px',fontSize:11,flexShrink:0 }}
                      title="Ir a la tarea">
                      Ver tarea ↓
                    </button>
                  </div>
                ))
              })}
            </div>
          )}

          {/* PROYECTOS */}
          {sortedProjects.map(project => {
            if (filterProject!=='all' && project.id!==parseInt(filterProject)) return null
            const ptasks     = filtered.filter(t => t.projectId===project.id)
            // Ocultar proyecto si tiene filtro activo y no hay tareas que coincidan
            const showNotes = filterStatus === 'all' && (showDone || true)
            if (filterStatus!=='all' && ptasks.length===0) return null
            if (search.trim() && ptasks.length===0 && !(project.notes||[]).some(n=>n.text.toLowerCase().includes(search.toLowerCase()))) return null
            const hasOverdue = project.tasks.some(t => getStatus(t.due_date,t.done)==='overdue')
            const isCollapsed = collapsedProjects[project.id] || false

            // Mezclar tareas y notas del proyecto ordenadas por created_at
            // Las notas solo se muestran cuando no hay filtro de estado activo
            const mixedItems = [
              ...ptasks.map(t => ({ ...t, _type:'task' })),
              ...(showNotes ? (project.notes||[]).map(n => ({ ...n, _type:'note', projectId:project.id })) : [])
            ].sort((a,b) => (a.created_at||'') > (b.created_at||'') ? 1 : -1)

            return (
              <div key={project.id} id={`project-${project.id}`} style={{ background:'var(--bg-surface)',border:`1px solid ${hasOverdue?'#dc262644':'#1e293b'}`,borderRadius:14,marginBottom:16,overflow:'hidden' }}>

                {/* Project header */}
                <div className="ft-proj-header" style={{ borderLeft:`4px solid ${project.color}`,padding:'12px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',background:`linear-gradient(90deg,${project.color}11,transparent)` }}>
                  <div style={{ display:'flex',alignItems:'center',gap:10,flexWrap:'wrap' }}>
                    <div style={{ width:9,height:9,borderRadius:'50%',background:project.color,flexShrink:0 }} />
                    <span style={{ fontWeight:700,fontSize:15 }}>{project.name}</span>
                    <span style={{ background:'var(--bg-elevated)',border:'1px solid var(--border-soft)',borderRadius:20,padding:'1px 9px',fontSize:11,color:'var(--text-muted)' }}>
                      {project.tasks.filter(t=>!t.done).length} tarea{project.tasks.filter(t=>!t.done).length!==1?'s':''} activa{project.tasks.filter(t=>!t.done).length!==1?'s':''} · {project.notes?.length||0} nota{(project.notes?.length||0)!==1?'s':''}
                    </span>
                    {hasOverdue && <span style={{ background:'#2d0a0a',border:'1px solid #dc2626',borderRadius:20,padding:'1px 9px',fontSize:11,color:'#ef4444',fontWeight:600 }}>⚠ Tareas vencidas</span>}
                  </div>
                  <div className="ft-proj-actions" style={{ display:'flex',gap:7 }}>
                    <button onClick={()=>setNewTaskFor(project.id)} style={{ background:'transparent',border:`1px solid ${project.color}`,color:project.color,padding:'5px 12px',borderRadius:7,cursor:'pointer',fontSize:12,fontWeight:600 }}>+ Tarea</button>
                    <button onClick={()=>setNewProjNote(n=>({...n,[project.id+'_open']:!(n[project.id+'_open'])}))} style={{ background:'transparent',border:'1px solid #4338ca',color:'#818cf8',padding:'5px 12px',borderRadius:7,cursor:'pointer',fontSize:12,fontWeight:600 }}>+ Nota</button>
                    <button onClick={()=>setCollapsedProjects(c=>({...c,[project.id]:!c[project.id]}))} title={isCollapsed?'Expandir':'Colapsar'} style={{ ...S.iconBtn,borderColor:`${project.color}44`,color:'var(--text-secondary)' }}>{isCollapsed?'▼':'▲'}</button>
                    <button onClick={()=>{ setMembersModal(project.id); setMemberSearch(''); setMemberResults([]) }} title="Gestionar miembros" style={{ ...S.iconBtn,borderColor:'#0e7490',color:'#22d3ee' }}>👥</button>
                    <button onClick={()=>setEditProject(project)} title="Editar proyecto" style={{ ...S.iconBtn,borderColor:`${project.color}66`,color:project.color }}>✏️</button>
                    <button onClick={()=>setConfirm({msg:`¿Archivar "${project.name}"? Podrás recuperarlo desde "Archivados".`,action:()=>doArchiveProject(project.id),title:'📦 Confirmar archivado',okLabel:'Archivar',okColor:'#d97706'})}
                      title="Archivar proyecto" style={{ ...S.iconBtn,borderColor:'#d9770633',color:'#f59e0b' }}>📦</button>
                    <button onClick={()=>setConfirm({msg:`¿Eliminar "${project.name}" y TODAS sus tareas y notas?`,action:()=>doDeleteProject(project.id)})}
                      style={{ ...S.iconBtn,borderColor:'#dc262633',color:'#ef4444',fontSize:15 }} title="Eliminar proyecto">🗑</button>
                  </div>
                </div>

                {/* Nueva nota rápida */}
                {newProjNote[project.id+'_open'] && (
                  <div style={{ background:'var(--bg-hover)',borderBottom:'1px solid var(--border)',padding:'10px 16px',display:'flex',gap:8 }}>
                    <input placeholder="Agregar nota al proyecto..." value={newProjNote[project.id]||''} onChange={e=>setNewProjNote(n=>({...n,[project.id]:e.target.value}))} onKeyDown={e=>{ if(e.key==='Enter'){ doAddProjectNote(project.id); setNewProjNote(n=>({...n,[project.id+'_open']:false})) } }} style={{ ...S.input,flex:1 }} autoFocus />
                    <button onClick={()=>{ doAddProjectNote(project.id); setNewProjNote(n=>({...n,[project.id+'_open']:false})) }} style={S.btnPrimary}>Agregar</button>
                    <button onClick={()=>setNewProjNote(n=>({...n,[project.id+'_open']:false}))} style={S.btnSecondary}>✕</button>
                  </div>
                )}

                {/* New task form */}
                {newTaskFor===project.id && (
                  <div className="ft-new-task" style={{ background:'var(--bg-elevated)',padding:'12px 16px',display:'flex',gap:8,flexWrap:'wrap',borderBottom:'1px solid var(--border-soft)',alignItems:'center' }}>
                    <input placeholder="Título *" value={newTask.title} onChange={e=>setNewTask(p=>({...p,title:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&newTask.title&&doAddTask(project.id)} style={{ ...S.input,flex:'2 1 160px' }} autoFocus />
                    <input placeholder="Responsable (opcional)" value={newTask.responsible} onChange={e=>setNewTask(p=>({...p,responsible:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&newTask.title&&doAddTask(project.id)} style={{ ...S.input,flex:'1 1 140px' }} />
                    <input type="date" value={newTask.due_date} onChange={e=>setNewTask(p=>({...p,due_date:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&newTask.title&&doAddTask(project.id)} title="Vencimiento (opcional)" style={{ ...S.input,flex:'0 1 148px' }} />
                    <button onClick={()=>doAddTask(project.id)} style={S.btnPrimary} disabled={!newTask.title}>Agregar</button>
                    <button onClick={()=>setNewTaskFor(null)} style={S.btnSecondary}>✕</button>
                  </div>
                )}

                {/* Lista mixta: tareas + notas ordenadas por fecha */}
                {!isCollapsed && (
                  <div>
                    {mixedItems.length===0 && (
                      <div style={{ padding:'16px',textAlign:'center',color:'var(--text-faint)',fontSize:13 }}>
                        Sin tareas ni notas aún.
                      </div>
                    )}
                    {mixedItems.map((item, idx) => {
                      if (item._type === 'note') {
                        // NOTA DE PROYECTO
                        return (
                          <div key={`note-${item.id}`} style={{ borderTop:idx===0?'none':'1px solid #1e293b',borderLeft:'3px solid #4338ca' }}>
                            <div style={{ padding:'10px 16px',display:'flex',alignItems:'flex-start',gap:10,background:'#0d182922' }}>
                              <div style={{ flexShrink:0,marginTop:3 }}>
                                <span style={{ background:'#1e1b4b',border:'1px solid #4338ca',color:'#818cf8',padding:'2px 7px',borderRadius:10,fontSize:10,fontWeight:700 }}>📝 NOTA</span>
                              </div>
                              <div style={{ flex:1,minWidth:0 }}>
                                <div style={{ fontSize:11,color:'var(--text-muted)',marginBottom:3 }}>{item.author||'—'} · {fmtDate(item.created_at)}</div>
                                <div style={{ fontSize:13,color:'var(--text-content)',lineHeight:1.5 }}>{item.text}</div>
                              </div>
                              <div style={{ display:'flex',gap:4,flexShrink:0 }}>
                                <button onClick={()=>setMoveNote({note:item,pId:project.id})} title="Mover a tarea" style={{ ...S.iconBtn,borderColor:'#6366f133',color:'#818cf8' }}>🔀</button>
                                <button onClick={()=>setEditNote({pId:project.id,note:item})} style={S.iconBtn} title="Editar">✏️</button>
                                <button onClick={()=>setConfirm({msg:'¿Eliminar esta nota?',action:()=>doDeleteProjectNote(project.id,item.id)})} style={{ ...S.iconBtn,borderColor:'#dc262633' }} title="Eliminar">🗑️</button>
                              </div>
                            </div>
                          </div>
                        )
                      }

                      // TAREA
                      const task   = item
                      const status = getStatus(task.due_date, task.done)
                      const cfg    = STATUS[status]
                      const isExp  = expanded===task.id
                      return (
                        <div key={`task-${task.id}`} id={`task-${task.id}`} style={{ borderTop:idx===0?'none':'1px solid #1e293b',background:isExp?cfg.bg:'transparent',transition:'background .2s' }}>
                          <div className="ft-task-row" style={{ padding:'11px 16px',display:'flex',alignItems:'center',gap:10,borderLeft:`3px solid ${cfg.border}` }}>
                            <div onClick={()=>doToggle(task.id)} style={{ width:21,height:21,borderRadius:5,border:`2px solid ${cfg.badge}`,background:task.done?cfg.badge:'transparent',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,fontSize:12,color:'#0f172a',fontWeight:900,transition:'all .15s' }}>{task.done&&'✓'}</div>
                            <div style={{ flex:1,minWidth:0 }}>
                              <div style={{ fontWeight:600,fontSize:14,textDecoration:task.done?'line-through':'none',color:task.done?'var(--text-faint)':(status==='overdue'?'#ef4444':status==='warning'?'#f59e0b':'var(--task-title)'),whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{task.title}</div>
                              <div className="ft-task-meta" style={{ fontSize:11,color:'var(--text-muted)',marginTop:2,display:'flex',gap:10,flexWrap:'wrap' }}>
                                {task.responsible && <span>👤 {task.responsible}</span>}
                                {task.due_date    && <span>📅 Vence: {fmtSimpleDate(task.due_date)}</span>}
                                <span>🗓 Registro: {fmtDate(task.created_at)}</span>
                                <span>💬 {task.comments.length} nota{task.comments.length!==1?'s':''}</span>
                              </div>
                            </div>
                            <div className="ft-task-badge" style={{ background:`${cfg.badge}22`,border:`1px solid ${cfg.badge}55`,color:cfg.badge,padding:'3px 9px',borderRadius:20,fontSize:11,fontWeight:600,whiteSpace:'nowrap',flexShrink:0 }}>● {cfg.label}</div>
                            <div className="ft-task-actions" style={{ display:'flex',gap:5,flexShrink:0 }}>
                              <button onClick={()=>setEditTask({pId:task.projectId,task})} style={S.iconBtn} title="Editar">✏️</button>
                              <button onClick={()=>setConfirm({msg:`¿Eliminar "${task.title}"?`,action:()=>doDeleteTask(task.projectId,task.id)})} style={{ ...S.iconBtn,borderColor:'#dc262633' }} title="Eliminar">🗑️</button>
                              <button onClick={()=>setExpanded(isExp?null:task.id)} style={{ ...S.iconBtn,fontSize:11 }}>{isExp?'▲':'▼'}</button>
                            </div>
                          </div>

                          {/* Task comments */}
                          {isExp && (
                            <div className="ft-task-comments" style={{ padding:'0 16px 14px 50px',borderLeft:`3px solid ${cfg.border}` }}>
                              <div style={{ fontSize:11,color:'var(--text-secondary)',fontWeight:700,marginBottom:8,textTransform:'uppercase',letterSpacing:1 }}>💬 Bitácora de la tarea</div>
                              {task.comments.length===0 && <div style={{ fontSize:13,color:'var(--text-faint)',marginBottom:10 }}>Sin notas aún.</div>}
                              {task.comments.map(c=>(
                                <div key={c.id} style={{ background:'var(--bg-elevated)',border:'1px solid var(--border-soft)',borderRadius:8,padding:'9px 12px',marginBottom:7,display:'flex',gap:10,alignItems:'flex-start' }}>
                                  <div style={{ flex:1 }}>
                                    <div style={{ fontSize:11,color:'var(--text-muted)',marginBottom:3 }}>{c.author||'—'} · {fmtDate(c.created_at)}</div>
                                    <div style={{ fontSize:13,color:'var(--text-content)' }}>{c.text}</div>
                                  </div>
                                  <div style={{ display:'flex',gap:4 }}>
                                    <button onClick={()=>setMoveComment({comment:c,pId:task.projectId,tId:task.id})} title="Mover a proyecto" style={{ ...S.iconBtn,borderColor:'#6366f133',color:'#818cf8' }}>🔀</button>
                                    <button onClick={()=>setEditComment({pId:task.projectId,tId:task.id,comment:c})} style={S.iconBtn} title="Editar">✏️</button>
                                    <button onClick={()=>setConfirm({msg:'¿Eliminar esta nota?',action:()=>doDeleteComment(task.projectId,task.id,c.id)})} style={{ ...S.iconBtn,borderColor:'#dc262633' }} title="Eliminar">🗑️</button>
                                  </div>
                                </div>
                              ))}
                              <div style={{ display:'flex',gap:8,marginTop:6 }}>
                                <input placeholder="Agregar nota..." value={newComment[task.id]||''} onChange={e=>setNewComment(p=>({...p,[task.id]:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&doAddComment(task.projectId,task.id)} style={{ ...S.input,flex:1 }} />
                                <button onClick={()=>doAddComment(task.projectId,task.id)} style={S.btnPrimary}>Agregar</button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Resumen cuando está colapsado */}
                {isCollapsed && (
                  <div style={{ padding:'10px 16px',borderTop:'1px solid var(--border)',display:'flex',gap:16,fontSize:12,color:'var(--text-faint)' }}>
                    <span>📌 {project.tasks.filter(t=>!t.done).length} pendiente{project.tasks.filter(t=>!t.done).length!==1?'s':''}</span>
                    <span>✅ {project.tasks.filter(t=>t.done).length} completada{project.tasks.filter(t=>t.done).length!==1?'s':''}</span>
                    <span>📝 {project.notes?.length||0} nota{(project.notes?.length||0)!==1?'s':''}</span>
                    {hasOverdue && <span style={{color:'#ef4444'}}>⚠ {project.tasks.filter(t=>getStatus(t.due_date,t.done)==='overdue').length} vencida{project.tasks.filter(t=>getStatus(t.due_date,t.done)==='overdue').length!==1?'s':''}</span>}
                  </div>
                )}
              </div>
            )
          })}

          {/* Archivo completadas */}
          {showDone && doneTasks.length>0 && (
            <div style={{ background:'#052e16',border:'1px solid #16a34a44',borderRadius:14,padding:18 }}>
              <div style={{ fontWeight:700,color:'#22c55e',marginBottom:4 }}>✅ Archivo — completadas</div>
              <div style={{ fontSize:12,color:'#4ade80',marginBottom:10 }}>{doneTasks.length} tarea(s) completada(s)</div>
              {doneTasks.map(t=>(
                <div key={t.id} style={{ background:'#0a3d1f',borderRadius:8,padding:'9px 14px',marginBottom:5,display:'flex',gap:10,fontSize:13,alignItems:'center' }}>
                  <span style={{ color:'#22c55e' }}>✓</span>
                  <span style={{ color:'#4ade80',textDecoration:'line-through',flex:1 }}>{t.title}</span>
                  <span style={{ color:'#166534',fontSize:11 }}>{t.projectName}{t.responsible?` · ${t.responsible}`:''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
