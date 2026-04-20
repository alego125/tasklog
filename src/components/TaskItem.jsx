import { S, STATUS, getStatus, fmtDate, fmtSimpleDate } from '../utils/helpers.js'

export default function TaskItem({ task, expanded, onToggle, onExpand, onEdit, onDelete, onEditComment, onDeleteComment, onMoveComment, onAddComment, newComment, onNewCommentChange, onConfirm, onEditDueDate, onEditCreatedAt }) {
  const status = getStatus(task.due_date, task.done)
  const cfg    = STATUS[status]
  const isExp  = expanded === task.id

  return (
    <div id={`task-${task.id}`} style={{ borderTop:'1px solid #1e293b', background:isExp?cfg.bg:'transparent', transition:'background .2s' }}>
      <div className="ft-task-row" style={{ padding:'11px 16px', display:'flex', alignItems:'center', gap:10, borderLeft:`3px solid ${cfg.border}` }}>
        {/* Checkbox */}
        <div
          onClick={() => onToggle(task.id)}
          style={{ width:21, height:21, borderRadius:5, border:`2px solid ${cfg.badge}`, background:task.done?cfg.badge:'transparent', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, fontSize:12, color:'#0f172a', fontWeight:900, transition:'all .15s' }}>
          {task.done && '✓'}
        </div>

        {/* Title + meta */}
        <div style={{ flex:1, minWidth:0 }}>
          <div onClick={() => onExpand(isExp ? null : task.id)} style={{ fontWeight:600, fontSize:14, textDecoration:task.done?'line-through':'none', color:task.done?cfg.badge:(status==='overdue'?'#ef4444':status==='warning'?'#f59e0b':'var(--task-title)'), wordBreak:'break-word', overflowWrap:'break-word', cursor:'pointer' }} title={isExp?'Colapsar':'Expandir bitácora'}>
            {task.title}
          </div>
          <div className="ft-task-meta" style={{ fontSize:11, color:'var(--text-muted)', marginTop:2, display:'flex', gap:10, flexWrap:'wrap' }}>
            {task.responsible && <span>👤 {task.responsible}</span>}
            {task.due_date    && <span onClick={()=>onEditDueDate&&onEditDueDate(task)} style={{ cursor:'pointer', textDecoration:'underline dotted' }} title="Editar vencimiento">📅 Vence: {fmtSimpleDate(task.due_date)}</span>}
<span onClick={()=>onEditCreatedAt&&onEditCreatedAt('task', null, task)} style={{ cursor:'pointer', textDecoration:'underline dotted' }} title="Editar fecha de registro">🗓 Registro: {fmtDate(task.created_at)}</span>
            <span>💬 {task.comments.length} nota{task.comments.length!==1?'s':''}</span>
          </div>
        </div>

        {/* Badge */}
        <div className="ft-task-badge" style={{ background:`${cfg.badge}22`, border:`1px solid ${cfg.badge}55`, color:cfg.badge, padding:'3px 9px', borderRadius:20, fontSize:11, fontWeight:600, whiteSpace:'nowrap', flexShrink:0 }}>
          ● {cfg.label}
        </div>

        {/* Actions */}
        <div className="ft-task-actions" style={{ display:'flex', gap:5, flexShrink:0 }}>
          <button onClick={() => onEdit(task)} style={S.iconBtn} title="Editar">✏️</button>
          <button onClick={() => onConfirm(`¿Eliminar "${task.title}"?`, () => onDelete(task.projectId, task.id))} style={{ ...S.iconBtn, borderColor:'#dc262633' }} title="Eliminar">🗑️</button>
          <button onClick={() => onExpand(isExp ? null : task.id)} style={{ ...S.iconBtn, fontSize:11 }}>{isExp?'▲':'▼'}</button>
        </div>
      </div>

      {/* Bitácora expandida */}
      {isExp && (
        <div className="ft-task-comments" style={{ padding:'0 16px 14px 50px', borderLeft:`3px solid ${cfg.border}` }}>
          <div style={{ fontSize:11, color:'var(--text-secondary)', fontWeight:700, marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>💬 Bitácora de la tarea</div>
          {task.comments.length === 0 && <div style={{ fontSize:13, color:'var(--text-faint)', marginBottom:10 }}>Sin notas aún.</div>}
          {task.comments.map(c => (
            <div key={c.id} style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-soft)', borderRadius:8, padding:'9px 12px', marginBottom:7, display:'flex', gap:10, alignItems:'flex-start' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:3 }}>{c.author||'—'} · <span onClick={()=>onEditCreatedAt&&onEditCreatedAt('comment', task.id, c)} style={{ cursor:'pointer', textDecoration:'underline dotted', color:'var(--text-secondary)' }} title="Editar fecha de registro">{fmtDate(c.created_at)}</span></div>
                <div style={{ fontSize:13, color:'var(--text-content)' }}>{c.text}</div>
              </div>
              <div style={{ display:'flex', gap:4 }}>
                <button onClick={() => onMoveComment(c, task.projectId, task.id)} title="Mover a proyecto" style={{ ...S.iconBtn, borderColor:'#6366f133', color:'#818cf8' }}>🔀</button>
                <button onClick={() => onEditComment(task.projectId, task.id, c)} style={S.iconBtn} title="Editar">✏️</button>
                <button onClick={() => onConfirm('¿Eliminar esta nota?', () => onDeleteComment(task.projectId, task.id, c.id))} style={{ ...S.iconBtn, borderColor:'#dc262633' }} title="Eliminar">🗑️</button>
              </div>
            </div>
          ))}
          <div style={{ display:'flex', gap:8, marginTop:6 }}>
            <input
              placeholder="Agregar nota..."
              value={newComment || ''}
              onChange={e => onNewCommentChange(task.id, e.target.value)}
              onKeyDown={e => e.key==='Enter' && onAddComment(task.projectId, task.id, newComment || '')}
              style={{ ...S.input, flex:1 }}
            />
            <button onClick={() => onAddComment(task.projectId, task.id, newComment || '')} style={S.btnPrimary}>Agregar</button>
          </div>
        </div>
      )}
    </div>
  )
}
