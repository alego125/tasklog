import { useState, useEffect } from 'react'
import { useProjects } from '../hooks/useProjects.js'
import { useToast } from '../hooks/useToast.js'
import { api, isNetworkError } from '../hooks/useApi.js'
import { S, COLORS, exportMeetingPrompt } from '../utils/helpers.js'
import ProjectCard from './ProjectCard.jsx'
import Toast from './Toast.jsx'
import { Confirm, EditProject, EditTask, EditComment, EditDueDateModal, EditCreatedAtModal, MoveNoteModal, MoveCommentModal, ParticipantsModal } from './Modals.jsx'

export default function MeetingBoard({ meeting, onBack }) {
  const proj = useProjects(meeting.id)
  const { toasts, toast, dismiss } = useToast()
  const errMsg = e => isNetworkError(e) || e?.message==='SIN_CONEXION'
    ? '⚠️ Sin conexión con la base de datos. La información no fue guardada.'
    : 'Error al guardar. Intentá nuevamente.'

  const [collapsedProjects, setCollapsedProjects] = useState({})
  const [expanded,          setExpanded]          = useState(null)
  const [newComment,        setNewComment]        = useState({})
  const [newProjNote,       setNewProjNote]       = useState({})
  const [newTaskFor,        setNewTaskFor]        = useState(null)
  const [newTask,           setNewTask]           = useState({ title:'', responsible:'', due_date:'' })
  const [newProjOpen,       setNewProjOpen]       = useState(false)
  const [newProjName,       setNewProjName]       = useState('')
  const [newProjColor,      setNewProjColor]      = useState(COLORS[0])

  const [editProject,   setEditProject]   = useState(null)
  const [editTask,      setEditTask]      = useState(null)
  const [editComment,   setEditComment]   = useState(null)
  const [editNote,      setEditNote]      = useState(null)
  const [editDueDate,   setEditDueDate]   = useState(null)
  const [editCreatedAt, setEditCreatedAt] = useState(null)
  const [confirm,       setConfirm]       = useState(null)
  const [moveNote,      setMoveNote]      = useState(null)
  const [moveComment,   setMoveComment]   = useState(null)
  const [participantsOpen, setParticipantsOpen] = useState(false)
  const [exporting,     setExporting]     = useState(false)

  useEffect(() => {
    proj.loadProjects().then(() => {
      setCollapsedProjects(prev => {
        const next = { ...prev }
        proj.projects.forEach(p => { if (!(p.id in next)) next[p.id] = true })
        return next
      })
    })
  }, [meeting.id])

  const showConfirm = (msg, action, opts={}) => setConfirm({ msg, action, ...opts })

  const doExportMinuta = async participants => {
    setParticipantsOpen(false)
    setExporting(true)
    try {
      const { temas } = await api.getMeetingExport(meeting.id)
      exportMeetingPrompt(meeting, temas, participants)
      toast('Prompt de minuta descargado')
    } catch(e) {
      toast(errMsg(e), 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      {/* Modales */}
      {confirm       && <Confirm msg={confirm.msg} onOk={()=>{confirm.action();setConfirm(null)}} onCancel={()=>setConfirm(null)} title={confirm.title} okLabel={confirm.okLabel} okColor={confirm.okColor} />}
      {editProject   && <EditProject project={editProject} onSave={(name,color) => { proj.doSaveEditProject(editProject,name,color).then(()=>toast('Tema actualizado')).catch(e=>toast(errMsg(e),'error')); setEditProject(null) }} onClose={()=>setEditProject(null)} />}
      {editTask      && <EditTask task={editTask.task} projects={proj.projects} onSave={form => { proj.doSaveEditTask(editTask.pId,editTask.task.id,form).then(()=>toast('Tarea actualizada')).catch(e=>toast(errMsg(e),'error')); setEditTask(null) }} onClose={()=>setEditTask(null)} />}
      {editComment   && <EditComment comment={editComment.comment} onSave={data => { proj.doSaveEditComment(editComment.pId,editComment.tId,editComment.comment.id,data).then(()=>toast('Nota actualizada')).catch(e=>toast(errMsg(e),'error')); setEditComment(null) }} onClose={()=>setEditComment(null)} />}
      {editNote      && <EditComment comment={editNote.note} onSave={data => { proj.doSaveEditNote(editNote.pId,editNote.note.id,data).then(()=>toast('Nota actualizada')).catch(e=>toast(errMsg(e),'error')); setEditNote(null) }} onClose={()=>setEditNote(null)} />}
      {editDueDate   && <EditDueDateModal task={editDueDate.task} onSave={due_date => { proj.doSaveEditTask(editDueDate.pId,editDueDate.task.id,{title:editDueDate.task.title,responsible:editDueDate.task.responsible||'',due_date}).then(()=>toast('Fecha actualizada')).catch(e=>toast(errMsg(e),'error')); setEditDueDate(null) }} onClose={()=>setEditDueDate(null)} />}
      {editCreatedAt && editCreatedAt.type==='task'    && <EditCreatedAtModal item={editCreatedAt.item} label={editCreatedAt.item.title} onSave={d => { proj.doSaveEditTask(editCreatedAt.pId,editCreatedAt.item.id,{title:editCreatedAt.item.title,responsible:editCreatedAt.item.responsible||'',due_date:editCreatedAt.item.due_date||'',created_at:d}).then(()=>toast('Fecha actualizada')).catch(e=>toast(errMsg(e),'error')); setEditCreatedAt(null) }} onClose={()=>setEditCreatedAt(null)} />}
      {editCreatedAt && editCreatedAt.type==='comment' && <EditCreatedAtModal item={editCreatedAt.item} label={editCreatedAt.item.text?.slice(0,60)} onSave={d => { proj.doSaveEditComment(editCreatedAt.pId,editCreatedAt.tId,editCreatedAt.item.id,{text:editCreatedAt.item.text,created_at:d}).then(()=>toast('Fecha actualizada')).catch(e=>toast(errMsg(e),'error')); setEditCreatedAt(null) }} onClose={()=>setEditCreatedAt(null)} />}
      {editCreatedAt && editCreatedAt.type==='note'    && <EditCreatedAtModal item={editCreatedAt.item} label={editCreatedAt.item.text?.slice(0,60)} onSave={d => { proj.doSaveEditNote(editCreatedAt.pId,editCreatedAt.item.id,{text:editCreatedAt.item.text,created_at:d}).then(()=>toast('Fecha actualizada')).catch(e=>toast(errMsg(e),'error')); setEditCreatedAt(null) }} onClose={()=>setEditCreatedAt(null)} />}
      {moveNote      && <MoveNoteModal note={moveNote.note} tasks={proj.allTasks.filter(t=>!t.done)} onMove={taskId => { proj.doMoveNoteToTask(moveNote.note,moveNote.pId,taskId,proj.allTasks).then(()=>toast('Nota movida a tarea')).catch(e=>toast(errMsg(e),'error')); setMoveNote(null) }} onClose={()=>setMoveNote(null)} />}
      {moveComment   && <MoveCommentModal comment={moveComment.comment} projects={proj.projects} currentProjectId={moveComment.pId} onMove={projectId => { proj.doMoveCommentToProject(moveComment.comment,moveComment.pId,moveComment.tId,projectId).then(()=>toast('Nota movida al tema')).catch(e=>toast(errMsg(e),'error')); setMoveComment(null) }} onClose={()=>setMoveComment(null)} />}
      {participantsOpen && <ParticipantsModal onClose={()=>setParticipantsOpen(false)} onGenerate={doExportMinuta} />}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10, marginBottom:18 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button onClick={onBack} style={S.btnSecondary}>← Volver a Reuniones</button>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:9, height:9, borderRadius:'50%', background:meeting.color }} />
            <div className="proj-title" style={{ fontSize:18 }}>{meeting.name}</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => setNewProjOpen(v=>!v)} style={S.btnPrimary}>+ Nuevo Tema</button>
          <button onClick={() => setParticipantsOpen(true)} disabled={exporting} style={{ ...S.btnSecondary, opacity:exporting?0.6:1 }}>
            {exporting ? '⏳ Generando...' : '📄 Descargar prompt de minuta'}
          </button>
        </div>
      </div>

      {/* Nuevo tema */}
      {newProjOpen && (
        <div style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-soft)', borderRadius:12, padding:14, marginBottom:16, display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
          <input placeholder="Nombre del tema..." value={newProjName} onChange={e=>setNewProjName(e.target.value)}
            onKeyDown={e => {
              if (e.key==='Enter' && newProjName.trim()) {
                proj.doAddProject(newProjName, newProjColor).then(() => { setNewProjName(''); setNewProjOpen(false); toast('Tema creado') }).catch(e => toast(errMsg(e),'error'))
              }
            }}
            style={{ ...S.input, flex:1 }} autoFocus />
          <div style={{ display:'flex', gap:6 }}>
            {COLORS.map(c => <div key={c} onClick={() => setNewProjColor(c)} style={{ width:22, height:22, borderRadius:'50%', background:c, cursor:'pointer', border:newProjColor===c?'3px solid white':'3px solid transparent', boxSizing:'border-box' }} />)}
          </div>
          <button onClick={() => { proj.doAddProject(newProjName,newProjColor).then(()=>{ setNewProjName(''); setNewProjOpen(false); toast('Tema creado') }).catch(e=>toast(errMsg(e),'error')) }} style={S.btnPrimary}>Crear</button>
          <button onClick={() => setNewProjOpen(false)} style={S.btnSecondary}>Cancelar</button>
        </div>
      )}

      {proj.loading && <div style={{ textAlign:'center', color:'var(--text-muted)', padding:30 }}>Cargando temas...</div>}
      {proj.error && <div style={{ textAlign:'center', color:'#ef4444', padding:30 }}>{proj.error}</div>}
      {!proj.loading && !proj.error && proj.sortedProjects.length === 0 && (
        <div style={{ textAlign:'center', color:'var(--text-faint)', fontSize:14, padding:40 }}>Todavía no hay temas cargados en esta reunión.</div>
      )}

      {proj.sortedProjects.map(project => (
        <ProjectCard
          key={project.id}
          project={project}
          filteredTasks={project.tasks}
          hideMembers
          collapsed={collapsedProjects[project.id]}
          onToggleCollapse={id => setCollapsedProjects(c=>({...c,[id]:!c[id]}))}
          expanded={expanded}
          onExpand={setExpanded}
          onToggleTask={proj.doToggle}
          showNotes={true}
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
          onDeleteProject={pId => proj.doDeleteProject(pId).then(()=>toast('Tema eliminado')).catch(e=>toast(errMsg(e),'error'))}
          onArchiveProject={pId => proj.doArchiveProject(pId).then(()=>toast('Tema archivado','warning')).catch(e=>toast(errMsg(e),'error'))}
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
      ))}

      <Toast toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
