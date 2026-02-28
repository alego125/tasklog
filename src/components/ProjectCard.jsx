import { S, getStatus, fmtDate } from '../utils/helpers.js'
import TaskItem from './TaskItem.jsx'

export default function ProjectCard({
  project, filteredTasks, collapsed, onToggleCollapse,
  expanded, onExpand, onToggleTask,
  newTaskFor, onOpenNewTask, newTask, onNewTaskChange, onAddTask,
  newProjNote, onNewProjNoteChange, onAddProjectNote,
  onEditProject, onDeleteProject, onArchiveProject,
  onMembersModal, onEditTask, onDeleteTask,
  onEditComment, onDeleteComment, onMoveComment, onMoveNote,
  onAddComment, newComment, onNewCommentChange,
  onEditNote, onDeleteNote, onConfirm, showNotes,
}) {
  const hasOverdue  = project.tasks.some(t => getStatus(t.due_date, t.done) === 'overdue')
  const isCollapsed = collapsed || false
  const noteOpen    = newProjNote[project.id + '_open']

  const mixedItems = [
    ...filteredTasks.map(t => ({ ...t, _type:'task' })),
    ...(showNotes ? (project.notes||[]).map(n => ({ ...n, _type:'note', projectId:project.id })) : [])
  ].sort((a,b) => (a.created_at||'') > (b.created_at||'') ? 1 : -1)

  return (
    <div id={`project-${project.id}`} style={{ background:'var(--bg-surface)', border:`1px solid ${hasOverdue?'#dc262644':'#1e293b'}`, borderRadius:14, marginBottom:16, overflow:'hidden' }}>

      {/* Header */}
      <div className="ft-proj-header" style={{ borderLeft:`4px solid ${project.color}`, padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', background:`linear-gradient(90deg,${project.color}11,transparent)` }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          <div style={{ width:9, height:9, borderRadius:'50%', background:project.color, flexShrink:0 }} />
          <span style={{ fontWeight:700, fontSize:15 }}>{project.name}</span>
          <span style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-soft)', borderRadius:20, padding:'1px 9px', fontSize:11, color:'var(--text-muted)' }}>
            {project.tasks.filter(t=>!t.done).length} tarea{project.tasks.filter(t=>!t.done).length!==1?'s':''} activa{project.tasks.filter(t=>!t.done).length!==1?'s':''} · {project.notes?.length||0} nota{(project.notes?.length||0)!==1?'s':''}
          </span>
          {hasOverdue && <span style={{ background:'#2d0a0a', border:'1px solid #dc2626', borderRadius:20, padding:'1px 9px', fontSize:11, color:'#ef4444', fontWeight:600 }}>⚠ Tareas vencidas</span>}
        </div>
        <div className="ft-proj-actions" style={{ display:'flex', gap:7 }}>
          <button onClick={() => onOpenNewTask(project.id)} style={{ background:'transparent', border:`1px solid ${project.color}`, color:project.color, padding:'5px 12px', borderRadius:7, cursor:'pointer', fontSize:12, fontWeight:600 }}>+ Tarea</button>
          <button onClick={() => onNewProjNoteChange(project.id+'_open', !noteOpen)} style={{ background:'transparent', border:'1px solid #4338ca', color:'#818cf8', padding:'5px 12px', borderRadius:7, cursor:'pointer', fontSize:12, fontWeight:600 }}>+ Nota</button>
          <button onClick={() => onToggleCollapse(project.id)} title={isCollapsed?'Expandir':'Colapsar'} style={{ ...S.iconBtn, borderColor:`${project.color}44`, color:'var(--text-secondary)' }}>{isCollapsed?'▼':'▲'}</button>
          <button onClick={() => onMembersModal(project.id)} title="Gestionar miembros" style={{ ...S.iconBtn, borderColor:'#0e7490', color:'#22d3ee' }}>👥</button>
          <button onClick={() => onEditProject(project)} title="Editar proyecto" style={{ ...S.iconBtn, borderColor:`${project.color}66`, color:project.color }}>✏️</button>
          <button onClick={() => onConfirm(`¿Archivar "${project.name}"? Podrás recuperarlo desde "Archivados".`, () => onArchiveProject(project.id), { title:'📦 Confirmar archivado', okLabel:'Archivar', okColor:'#d97706' })} title="Archivar proyecto" style={{ ...S.iconBtn, borderColor:'#d9770633', color:'#f59e0b' }}>📦</button>
          <button onClick={() => onConfirm(`¿Eliminar "${project.name}" y TODAS sus tareas y notas?`, () => onDeleteProject(project.id))} style={{ ...S.iconBtn, borderColor:'#dc262633', color:'#ef4444', fontSize:15 }} title="Eliminar proyecto">🗑</button>
        </div>
      </div>

      {/* Nueva nota rápida */}
      {noteOpen && (
        <div style={{ background:'var(--bg-hover)', borderBottom:'1px solid var(--border)', padding:'10px 16px', display:'flex', gap:8 }}>
          <input
            placeholder="Agregar nota al proyecto..."
            value={newProjNote[project.id] || ''}
            onChange={e => onNewProjNoteChange(project.id, e.target.value)}
            onKeyDown={e => { if(e.key==='Enter') { onAddProjectNote(project.id); onNewProjNoteChange(project.id+'_open', false) } }}
            style={{ ...S.input, flex:1 }}
            autoFocus
          />
          <button onClick={() => { onAddProjectNote(project.id); onNewProjNoteChange(project.id+'_open', false) }} style={S.btnPrimary}>Agregar</button>
          <button onClick={() => onNewProjNoteChange(project.id+'_open', false)} style={S.btnSecondary}>✕</button>
        </div>
      )}

      {/* Nueva tarea */}
      {newTaskFor === project.id && (
        <div className="ft-new-task" style={{ background:'var(--bg-elevated)', padding:'12px 16px', display:'flex', gap:8, flexWrap:'wrap', borderBottom:'1px solid var(--border-soft)', alignItems:'center' }}>
          <input placeholder="Título *" value={newTask.title} onChange={e=>onNewTaskChange({...newTask,title:e.target.value})} onKeyDown={e=>e.key==='Enter'&&newTask.title&&onAddTask(project.id)} style={{ ...S.input, flex:'2 1 160px' }} autoFocus />
          <input placeholder="Responsable (opcional)" value={newTask.responsible} onChange={e=>onNewTaskChange({...newTask,responsible:e.target.value})} onKeyDown={e=>e.key==='Enter'&&newTask.title&&onAddTask(project.id)} style={{ ...S.input, flex:'1 1 140px' }} />
          <input type="date" value={newTask.due_date} onChange={e=>onNewTaskChange({...newTask,due_date:e.target.value})} onKeyDown={e=>e.key==='Enter'&&newTask.title&&onAddTask(project.id)} title="Vencimiento (opcional)" style={{ ...S.input, flex:'0 1 148px' }} />
          <button onClick={() => onAddTask(project.id)} style={S.btnPrimary} disabled={!newTask.title}>Agregar</button>
          <button onClick={() => onOpenNewTask(null)} style={S.btnSecondary}>✕</button>
        </div>
      )}

      {/* Lista mixta */}
      {!isCollapsed && (
        <div>
          {mixedItems.length === 0 && (
            <div style={{ padding:'16px', textAlign:'center', color:'var(--text-faint)', fontSize:13 }}>Sin tareas ni notas aún.</div>
          )}
          {mixedItems.map((item, idx) => {
            if (item._type === 'note') return (
              <div key={`note-${item.id}`} style={{ borderTop:idx===0?'none':'1px solid #1e293b', borderLeft:'3px solid #4338ca' }}>
                <div style={{ padding:'10px 16px', display:'flex', alignItems:'flex-start', gap:10, background:'#0d182922' }}>
                  <div style={{ flexShrink:0, marginTop:3 }}>
                    <span style={{ background:'#1e1b4b', border:'1px solid #4338ca', color:'#818cf8', padding:'2px 7px', borderRadius:10, fontSize:10, fontWeight:700 }}>📝 NOTA</span>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:3 }}>{item.author||'—'} · {fmtDate(item.created_at)}</div>
                    <div style={{ fontSize:13, color:'var(--text-content)', lineHeight:1.5 }}>{item.text}</div>
                  </div>
                  <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                    <button onClick={() => onMoveNote(item, project.id)} title="Mover a tarea" style={{ ...S.iconBtn, borderColor:'#6366f133', color:'#818cf8' }}>🔀</button>
                    <button onClick={() => onEditNote(project.id, item)} style={S.iconBtn} title="Editar">✏️</button>
                    <button onClick={() => onConfirm('¿Eliminar esta nota?', () => onDeleteNote(project.id, item.id))} style={{ ...S.iconBtn, borderColor:'#dc262633' }} title="Eliminar">🗑️</button>
                  </div>
                </div>
              </div>
            )

            return (
              <TaskItem
                key={`task-${item.id}`}
                task={item}
                expanded={expanded}
                onToggle={onToggleTask}
                onExpand={onExpand}
                onEdit={task => onEditTask(item.projectId, task)}
                onDelete={onDeleteTask}
                onEditComment={onEditComment}
                onDeleteComment={onDeleteComment}
                onMoveComment={onMoveComment}
                onAddComment={onAddComment}
                newComment={newComment[item.id]}
                onNewCommentChange={onNewCommentChange}
                onConfirm={onConfirm}
              />
            )
          })}
        </div>
      )}

      {/* Resumen colapsado */}
      {isCollapsed && (
        <div style={{ padding:'10px 16px', borderTop:'1px solid var(--border)', display:'flex', gap:16, fontSize:12, color:'var(--text-faint)' }}>
          <span>📌 {project.tasks.filter(t=>!t.done).length} pendiente{project.tasks.filter(t=>!t.done).length!==1?'s':''}</span>
          <span>✅ {project.tasks.filter(t=>t.done).length} completada{project.tasks.filter(t=>t.done).length!==1?'s':''}</span>
          <span>📝 {project.notes?.length||0} nota{(project.notes?.length||0)!==1?'s':''}</span>
          {hasOverdue && <span style={{color:'#ef4444'}}>⚠ {project.tasks.filter(t=>getStatus(t.due_date,t.done)==='overdue').length} vencida{project.tasks.filter(t=>getStatus(t.due_date,t.done)==='overdue').length!==1?'s':''}</span>}
        </div>
      )}
    </div>
  )
}
