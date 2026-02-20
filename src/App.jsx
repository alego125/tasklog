import { useState, useMemo, useEffect, useCallback } from 'react'
import { api } from './hooks/useApi.js'
import { Confirm, EditTask, EditComment } from './components/Modals.jsx'
import SchemaView from './components/SchemaView.jsx'

const getStatus = (due, done) => {
  if (done) return 'done'
  const diff = (new Date(due) - new Date()) / 86400000
  if (diff < 0) return 'overdue'
  if (diff <= 3) return 'warning'
  return 'ok'
}

const STATUS = {
  done:    { bg:'#052e16', border:'#16a34a', badge:'#22c55e', label:'Completada' },
  overdue: { bg:'#2d0a0a', border:'#dc2626', badge:'#ef4444', label:'Vencida'    },
  warning: { bg:'#2d1f00', border:'#d97706', badge:'#f59e0b', label:'Por vencer' },
  ok:      { bg:'#0f172a', border:'#334155', badge:'#64748b', label:'En curso'   },
}

const COLORS = ['#6366f1','#8b5cf6','#ec4899','#14b8a6','#f97316','#06b6d4','#f59e0b']

const S = {
  input:  { background:'#1e293b', border:'1px solid #334155', color:'#e2e8f0', padding:'8px 12px', borderRadius:8, fontSize:13, outline:'none', boxSizing:'border-box' },
  select: { background:'#1e293b', border:'1px solid #334155', color:'#e2e8f0', padding:'8px 12px', borderRadius:8, fontSize:13, outline:'none', cursor:'pointer' },
  btnPrimary:   { background:'linear-gradient(135deg,#6366f1,#8b5cf6)', border:'none', color:'white', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600, whiteSpace:'nowrap' },
  btnSecondary: { background:'#1e293b', border:'1px solid #334155', color:'#94a3b8', padding:'8px 14px', borderRadius:8, cursor:'pointer', fontSize:13, whiteSpace:'nowrap' },
  iconBtn: { background:'transparent', border:'1px solid #334155', color:'#94a3b8', width:28, height:28, borderRadius:6, cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', padding:0, flexShrink:0 },
}

export default function App() {
  const [projects, setProjects]           = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  const [search, setSearch]               = useState('')
  const [filterStatus, setFilterStatus]   = useState('all')
  const [filterProject, setFilterProject] = useState('all')
  const [showDone, setShowDone]           = useState(false)
  const [expanded, setExpanded]           = useState(null)
  const [newComment, setNewComment]       = useState({})
  const [newTaskFor, setNewTaskFor]       = useState(null)
  const [newTask, setNewTask]             = useState({ title:'', responsible:'', due_date:'' })
  const [newProjOpen, setNewProjOpen]     = useState(false)
  const [newProjName, setNewProjName]     = useState('')
  const [newProjColor, setNewProjColor]   = useState('#6366f1')
  const [schemaView, setSchemaView]       = useState(false)
  const [editTask, setEditTask]           = useState(null)
  const [editComment, setEditComment]     = useState(null)
  const [confirm, setConfirm]             = useState(null)

  // ── Cargar datos desde SQLite via API ──
  const loadProjects = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const data = await api.getProjects()
      setProjects(data)
    } catch(e) {
      setError('No se pudo conectar con el servidor. ¿Está corriendo? (npm run dev)')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadProjects() }, [loadProjects])

  // ── Datos computados ──
  const allTasks = useMemo(()=>
    projects.flatMap(p=>p.tasks.map(t=>({...t, projectId:p.id, projectName:p.name, projectColor:p.color}))),
    [projects])

  const filtered = useMemo(()=>allTasks.filter(t=>{
    const st = getStatus(t.due_date, t.done)
    return (
      (t.title.toLowerCase().includes(search.toLowerCase()) ||
       t.projectName.toLowerCase().includes(search.toLowerCase()) ||
       (t.responsible||'').toLowerCase().includes(search.toLowerCase())) &&
      (filterStatus==='all' || st===filterStatus) &&
      (filterProject==='all' || t.projectId===parseInt(filterProject)) &&
      (showDone || !t.done)
    )
  }), [allTasks, search, filterStatus, filterProject, showDone])

  const doneTasks = allTasks.filter(t=>t.done)

  // ── Acciones ──
  const doToggle = async (id) => {
    const updated = await api.toggleTask(id)
    setProjects(prev=>prev.map(p=>({...p, tasks:p.tasks.map(t=>t.id===id?{...updated}:t)})))
  }

  const doAddComment = async (projectId, taskId) => {
    const text = (newComment[taskId]||'').trim()
    if(!text) return
    const comment = await api.createComment({ task_id:taskId, text })
    setProjects(prev=>prev.map(p=>p.id===projectId?{...p,tasks:p.tasks.map(t=>t.id===taskId?{...t,comments:[...t.comments,comment]}:t)}:p))
    setNewComment(p=>({...p,[taskId]:''}))
  }

  const doSaveEditTask = async (form) => {
    const updated = await api.updateTask(editTask.task.id, form)
    setProjects(prev=>prev.map(p=>p.id===editTask.pId?{...p,tasks:p.tasks.map(t=>t.id===updated.id?{...t,...updated}:t)}:p))
    setEditTask(null)
  }

  const doSaveEditComment = async (text) => {
    const updated = await api.updateComment(editComment.comment.id, text)
    const { pId, tId } = editComment
    setProjects(prev=>prev.map(p=>p.id===pId?{...p,tasks:p.tasks.map(t=>t.id===tId?{...t,comments:t.comments.map(c=>c.id===updated.id?updated:c)}:t)}:p))
    setEditComment(null)
  }

  const doDeleteTask = async (pId, tId) => {
    await api.deleteTask(tId)
    setProjects(prev=>prev.map(p=>p.id===pId?{...p,tasks:p.tasks.filter(t=>t.id!==tId)}:p))
  }

  const doDeleteComment = async (pId, tId, cId) => {
    await api.deleteComment(cId)
    setProjects(prev=>prev.map(p=>p.id===pId?{...p,tasks:p.tasks.map(t=>t.id===tId?{...t,comments:t.comments.filter(c=>c.id!==cId)}:t)}:p))
  }

  const doDeleteProject = async (pId) => {
    await api.deleteProject(pId)
    setProjects(prev=>prev.filter(p=>p.id!==pId))
  }

  const doAddTask = async (projectId) => {
    if(!newTask.title||!newTask.responsible||!newTask.due_date) return
    const task = await api.createTask({ project_id:projectId, ...newTask })
    setProjects(prev=>prev.map(p=>p.id===projectId?{...p,tasks:[...p.tasks,task]}:p))
    setNewTask({ title:'', responsible:'', due_date:'' }); setNewTaskFor(null)
  }

  const doAddProject = async () => {
    if(!newProjName.trim()) return
    const project = await api.createProject(newProjName, newProjColor)
    setProjects(prev=>[...prev, project])
    setNewProjName(''); setNewProjOpen(false)
  }

  const exportCSV = () => {
    const rows=[['Proyecto','Título','Responsable','Creada','Vencimiento','Estado','Completada','Comentarios']]
    projects.forEach(p=>p.tasks.forEach(t=>rows.push([p.name,t.title,t.responsible||'',t.created_at,t.due_date,STATUS[getStatus(t.due_date,t.done)].label,t.done?'Sí':'No',t.comments.map(c=>c.text).join(' | ')])))
    const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv'}))
    a.download=`TaskLog_${new Date().toISOString().split('T')[0]}.csv`; a.click()
  }

  // ── Estados de carga / error ──
  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#070d1a', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16, color:'#64748b', fontFamily:'sans-serif' }}>
      <div style={{ width:42,height:42,borderRadius:10,background:'linear-gradient(135deg,#6366f1,#8b5cf6)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22 }}>📋</div>
      <div>Conectando con la base de datos SQLite...</div>
    </div>
  )

  if (error) return (
    <div style={{ minHeight:'100vh', background:'#070d1a', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16, color:'#e2e8f0', fontFamily:'sans-serif', padding:24, textAlign:'center' }}>
      <div style={{ fontSize:40 }}>⚠️</div>
      <div style={{ fontSize:18, fontWeight:700 }}>Error de conexión</div>
      <div style={{ color:'#94a3b8', maxWidth:400, lineHeight:1.6 }}>{error}</div>
      <button onClick={loadProjects} style={{ background:'#6366f1', border:'none', color:'white', padding:'10px 24px', borderRadius:8, cursor:'pointer', fontSize:14 }}>Reintentar</button>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#070d1a', fontFamily:"'DM Sans','Segoe UI',sans-serif", color:'#e2e8f0' }}>

      {confirm     && <Confirm msg={confirm.msg} onOk={()=>{confirm.action();setConfirm(null)}} onCancel={()=>setConfirm(null)} />}
      {editTask    && <EditTask task={editTask.task} onSave={doSaveEditTask} onClose={()=>setEditTask(null)} />}
      {editComment && <EditComment comment={editComment.comment} onSave={doSaveEditComment} onClose={()=>setEditComment(null)} />}

      {/* HEADER */}
      <div style={{ background:'linear-gradient(135deg,#0f172a,#1e1b4b)', borderBottom:'1px solid #1e293b', padding:'18px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100, flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:38,height:38,borderRadius:9,background:'linear-gradient(135deg,#6366f1,#8b5cf6)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:19 }}>📋</div>
          <div>
            <div style={{ fontSize:19,fontWeight:700,letterSpacing:'-0.5px' }}>TaskLog</div>
            <div style={{ fontSize:11,color:'#64748b',display:'flex',alignItems:'center',gap:6 }}>
              <span style={{ color:'#22c55e' }}>● SQLite</span> · Datos persistentes en archivo local
            </div>
          </div>
        </div>
        <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
          {!schemaView && <button onClick={exportCSV} style={{ background:'#065f46',border:'1px solid #059669',color:'#34d399',padding:'8px 16px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600 }}>⬇ Exportar CSV</button>}
          <button onClick={()=>setSchemaView(v=>!v)} style={{ background:schemaView?'#6366f1':'#1e293b',border:'1px solid #334155',color:'#e2e8f0',padding:'8px 16px',borderRadius:8,cursor:'pointer',fontSize:13 }}>
            {schemaView?'← Ver App':'🗄️ Esquema BD'}
          </button>
          {!schemaView && <button onClick={()=>setNewProjOpen(true)} style={S.btnPrimary}>+ Nuevo Proyecto</button>}
        </div>
      </div>

      {schemaView ? <SchemaView /> : (
        <div style={{ maxWidth:1200,margin:'0 auto',padding:'28px 20px' }}>

          {/* FILTROS */}
          <div style={{ background:'#0f172a',border:'1px solid #1e293b',borderRadius:12,padding:'12px 16px',marginBottom:18,display:'flex',gap:10,flexWrap:'wrap',alignItems:'center' }}>
            <input placeholder="🔍 Buscar por tarea, proyecto o responsable..." value={search} onChange={e=>setSearch(e.target.value)} style={{ flex:'1 1 220px',...S.input }} />
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={S.select}>
              <option value="all">Todos los estados</option>
              <option value="ok">En curso</option>
              <option value="warning">Por vencer</option>
              <option value="overdue">Vencidas</option>
            </select>
            <select value={filterProject} onChange={e=>setFilterProject(e.target.value)} style={S.select}>
              <option value="all">Todos los proyectos</option>
              {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <label style={{ display:'flex',alignItems:'center',gap:7,fontSize:13,cursor:'pointer',whiteSpace:'nowrap' }}>
              <input type="checkbox" checked={showDone} onChange={e=>setShowDone(e.target.checked)} style={{ accentColor:'#6366f1' }} /> Mostrar completadas
            </label>
          </div>

          {/* STATS */}
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))',gap:10,marginBottom:18 }}>
            {[
              {label:'Total',       val:allTasks.length,                                               color:'#6366f1'},
              {label:'En curso',    val:allTasks.filter(t=>getStatus(t.due_date,t.done)==='ok').length,     color:'#64748b'},
              {label:'Por vencer',  val:allTasks.filter(t=>getStatus(t.due_date,t.done)==='warning').length, color:'#f59e0b'},
              {label:'Vencidas',    val:allTasks.filter(t=>getStatus(t.due_date,t.done)==='overdue').length, color:'#ef4444'},
              {label:'Completadas', val:doneTasks.length,                                               color:'#22c55e'},
            ].map(s=>(
              <div key={s.label} style={{ background:'#0f172a',border:`1px solid ${s.color}44`,borderRadius:10,padding:'12px 14px',textAlign:'center' }}>
                <div style={{ fontSize:24,fontWeight:800,color:s.color }}>{s.val}</div>
                <div style={{ fontSize:11,color:'#64748b',marginTop:2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* NUEVO PROYECTO */}
          {newProjOpen && (
            <div style={{ background:'#1e293b',border:'1px solid #334155',borderRadius:12,padding:14,marginBottom:16,display:'flex',gap:10,flexWrap:'wrap',alignItems:'center' }}>
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

          {/* PROYECTOS */}
          {projects.map(project=>{
            if(filterProject!=='all'&&project.id!==parseInt(filterProject))return null
            const ptasks=filtered.filter(t=>t.projectId===project.id)
            return (
              <div key={project.id} style={{ background:'#0f172a',border:'1px solid #1e293b',borderRadius:14,marginBottom:16,overflow:'hidden' }}>
                {/* Header */}
                <div style={{ borderLeft:`4px solid ${project.color}`,padding:'12px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',background:`linear-gradient(90deg,${project.color}11,transparent)` }}>
                  <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                    <div style={{ width:9,height:9,borderRadius:'50%',background:project.color }} />
                    <span style={{ fontWeight:700,fontSize:15 }}>{project.name}</span>
                    <span style={{ background:'#1e293b',border:'1px solid #334155',borderRadius:20,padding:'1px 9px',fontSize:11,color:'#64748b' }}>{project.tasks.length} tarea{project.tasks.length!==1?'s':''}</span>
                  </div>
                  <div style={{ display:'flex',gap:7 }}>
                    <button onClick={()=>setNewTaskFor(project.id)} style={{ background:'transparent',border:`1px solid ${project.color}`,color:project.color,padding:'5px 12px',borderRadius:7,cursor:'pointer',fontSize:12,fontWeight:600 }}>+ Tarea</button>
                    <button onClick={()=>setConfirm({msg:`¿Eliminar "${project.name}" y TODAS sus tareas?`,action:()=>doDeleteProject(project.id)})}
                      style={{ ...S.iconBtn,borderColor:'#dc262633',color:'#ef4444',fontSize:15 }} title="Eliminar proyecto">🗑</button>
                  </div>
                </div>

                {/* Form nueva tarea */}
                {newTaskFor===project.id && (
                  <div style={{ background:'#1e293b',padding:'12px 16px',display:'flex',gap:8,flexWrap:'wrap',borderBottom:'1px solid #334155' }}>
                    <input placeholder="Título" value={newTask.title} onChange={e=>setNewTask(p=>({...p,title:e.target.value}))} style={{ ...S.input,flex:'2 1 160px' }} autoFocus />
                    <input placeholder="Responsable" value={newTask.responsible} onChange={e=>setNewTask(p=>({...p,responsible:e.target.value}))} style={{ ...S.input,flex:'1 1 120px' }} />
                    <input type="date" value={newTask.due_date} onChange={e=>setNewTask(p=>({...p,due_date:e.target.value}))} style={{ ...S.input,flex:'0 1 148px' }} />
                    <button onClick={()=>doAddTask(project.id)} style={S.btnPrimary}>Agregar</button>
                    <button onClick={()=>setNewTaskFor(null)} style={S.btnSecondary}>✕</button>
                  </div>
                )}

                {/* Tareas */}
                <div>
                  {ptasks.length===0&&(
                    <div style={{ padding:'16px',textAlign:'center',color:'#475569',fontSize:13 }}>
                      {project.tasks.length===0?'Sin tareas aún. ¡Agrega la primera!':'Ninguna tarea coincide con los filtros.'}
                    </div>
                  )}
                  {ptasks.map((task,idx)=>{
                    const status=getStatus(task.due_date,task.done)
                    const cfg=STATUS[status]
                    const isExp=expanded===task.id
                    return (
                      <div key={task.id} style={{ borderTop:idx===0?'none':'1px solid #1e293b',background:isExp?cfg.bg:'transparent',transition:'background .2s' }}>
                        <div style={{ padding:'11px 16px',display:'flex',alignItems:'center',gap:10,borderLeft:`3px solid ${cfg.border}` }}>
                          <div onClick={()=>doToggle(task.id)} style={{ width:21,height:21,borderRadius:5,border:`2px solid ${cfg.badge}`,background:task.done?cfg.badge:'transparent',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,fontSize:12,color:'#0f172a',fontWeight:900,transition:'all .15s' }}>{task.done&&'✓'}</div>
                          <div style={{ flex:1,minWidth:0 }}>
                            <div style={{ fontWeight:600,fontSize:14,textDecoration:task.done?'line-through':'none',color:task.done?'#475569':'#e2e8f0',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{task.title}</div>
                            <div style={{ fontSize:11,color:'#64748b',marginTop:2,display:'flex',gap:10,flexWrap:'wrap' }}>
                              <span>👤 {task.responsible||'—'}</span><span>📅 {task.due_date}</span><span>💬 {task.comments.length} nota{task.comments.length!==1?'s':''}</span>
                            </div>
                          </div>
                          <div style={{ background:`${cfg.badge}22`,border:`1px solid ${cfg.badge}55`,color:cfg.badge,padding:'3px 9px',borderRadius:20,fontSize:11,fontWeight:600,whiteSpace:'nowrap',flexShrink:0 }}>● {cfg.label}</div>
                          <div style={{ display:'flex',gap:5,flexShrink:0 }}>
                            <button onClick={()=>setEditTask({pId:task.projectId,task})} style={S.iconBtn} title="Editar">✏️</button>
                            <button onClick={()=>setConfirm({msg:`¿Eliminar "${task.title}"?`,action:()=>doDeleteTask(task.projectId,task.id)})} style={{ ...S.iconBtn,borderColor:'#dc262633' }} title="Eliminar">🗑️</button>
                            <button onClick={()=>setExpanded(isExp?null:task.id)} style={{ ...S.iconBtn,fontSize:11 }}>{isExp?'▲':'▼'}</button>
                          </div>
                        </div>

                        {isExp&&(
                          <div style={{ padding:'0 16px 14px 50px',borderLeft:`3px solid ${cfg.border}` }}>
                            <div style={{ fontSize:11,color:'#94a3b8',fontWeight:700,marginBottom:8,textTransform:'uppercase',letterSpacing:1 }}>💬 Bitácora de notas</div>
                            {task.comments.length===0&&<div style={{ fontSize:13,color:'#475569',marginBottom:10 }}>Sin notas aún.</div>}
                            {task.comments.map(c=>(
                              <div key={c.id} style={{ background:'#1e293b',border:'1px solid #334155',borderRadius:8,padding:'9px 12px',marginBottom:7,display:'flex',gap:10,alignItems:'flex-start' }}>
                                <div style={{ flex:1 }}>
                                  <div style={{ fontSize:11,color:'#64748b',marginBottom:3 }}>{c.author} · {c.created_at?.split('T')[0]||c.created_at}</div>
                                  <div style={{ fontSize:13,color:'#cbd5e1' }}>{c.text}</div>
                                </div>
                                <div style={{ display:'flex',gap:4 }}>
                                  <button onClick={()=>setEditComment({pId:task.projectId,tId:task.id,comment:c})} style={S.iconBtn}>✏️</button>
                                  <button onClick={()=>setConfirm({msg:'¿Eliminar esta nota?',action:()=>doDeleteComment(task.projectId,task.id,c.id)})} style={{ ...S.iconBtn,borderColor:'#dc262633' }}>🗑️</button>
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
              </div>
            )
          })}

          {/* Archivo completadas */}
          {showDone&&doneTasks.length>0&&(
            <div style={{ background:'#052e16',border:'1px solid #16a34a44',borderRadius:14,padding:18 }}>
              <div style={{ fontWeight:700,color:'#22c55e',marginBottom:4 }}>✅ Archivo — completadas</div>
              <div style={{ fontSize:12,color:'#4ade80',marginBottom:10 }}>{doneTasks.length} tarea(s) completada(s)</div>
              {doneTasks.map(t=>(
                <div key={t.id} style={{ background:'#0a3d1f',borderRadius:8,padding:'9px 14px',marginBottom:5,display:'flex',gap:10,fontSize:13,alignItems:'center' }}>
                  <span style={{ color:'#22c55e' }}>✓</span>
                  <span style={{ color:'#4ade80',textDecoration:'line-through',flex:1 }}>{t.title}</span>
                  <span style={{ color:'#166534',fontSize:11 }}>{t.projectName} · {t.responsible||'—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
