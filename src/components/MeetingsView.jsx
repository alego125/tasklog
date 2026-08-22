import { useState } from 'react'
import { S, COLORS, fmtDate } from '../utils/helpers.js'

export default function MeetingsView({
  meetings, archivedView, archivedMeetings, loadingArchived,
  onOpenMeeting, onToggleArchivedView,
  onAddMeeting, onEditMeeting, onArchiveMeeting, onUnarchiveMeeting, onDeleteMeeting,
  onConfirm,
}) {
  const [newOpen, setNewOpen]   = useState(false)
  const [name, setName]         = useState('')
  const [color, setColor]       = useState(COLORS[0])
  const [editing, setEditing]   = useState(null) // { id, name, color } | null

  const create = () => {
    if (!name.trim()) return
    onAddMeeting(name, color)
    setName(''); setColor(COLORS[0]); setNewOpen(false)
  }

  const list = archivedView ? archivedMeetings : meetings

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10, marginBottom:18 }}>
        <div style={{ fontSize:18, fontWeight:700 }}>📅 {archivedView ? 'Reuniones cerradas' : 'Reuniones'}</div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={onToggleArchivedView} style={{ ...S.btnSecondary, padding:'6px 14px' }}>
            {archivedView ? '← Volver a reuniones' : '📦 Ver cerradas'}
          </button>
          {!archivedView && <button onClick={() => setNewOpen(v => !v)} style={S.btnPrimary}>+ Nueva Reunión</button>}
        </div>
      </div>

      {newOpen && !archivedView && (
        <div style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-soft)', borderRadius:12, padding:14, marginBottom:16, display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
          <input placeholder="Nombre de la reunión..." value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&create()} style={{ ...S.input, flex:1 }} autoFocus />
          <div style={{ display:'flex', gap:6 }}>
            {COLORS.map(c => <div key={c} onClick={() => setColor(c)} style={{ width:22, height:22, borderRadius:'50%', background:c, cursor:'pointer', border:color===c?'3px solid white':'3px solid transparent', boxSizing:'border-box' }} />)}
          </div>
          <button onClick={create} style={S.btnPrimary}>Crear</button>
          <button onClick={() => setNewOpen(false)} style={S.btnSecondary}>Cancelar</button>
        </div>
      )}

      {editing && (
        <div onClick={()=>setEditing(null)} style={{ position:'fixed', inset:0, background:'rgba(44,38,32,0.45)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'var(--bg-surface)', border:'1px solid var(--border-soft)', borderRadius:14, padding:28, width:'100%', maxWidth:420, boxShadow:'0 30px 80px #0009' }}>
            <div className="proj-title" style={{ fontSize:16, marginBottom:18 }}>✏️ Editar reunión</div>
            <label style={S.label}>Nombre
              <input value={editing.name} onChange={e=>setEditing(p=>({...p,name:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&editing.name.trim()&&(onEditMeeting(editing),setEditing(null))} style={{...S.input, marginTop:4}} autoFocus />
            </label>
            <div style={{ display:'flex', gap:8, marginTop:14 }}>
              {COLORS.map(c => <div key={c} onClick={()=>setEditing(p=>({...p,color:c}))} style={{ width:24, height:24, borderRadius:'50%', background:c, cursor:'pointer', border:editing.color===c?'3px solid white':'3px solid transparent', boxSizing:'border-box' }} />)}
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:22 }}>
              <button onClick={()=>setEditing(null)} style={S.btnSecondary}>Cancelar</button>
              <button onClick={()=>editing.name.trim()&&(onEditMeeting(editing),setEditing(null))} style={S.btnPrimary}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {archivedView && loadingArchived && <div style={{ textAlign:'center', color:'var(--text-muted)', padding:30 }}>Cargando...</div>}

      {!loadingArchived && list.length === 0 && (
        <div style={{ textAlign:'center', color:'var(--text-faint)', fontSize:14, padding:40 }}>
          {archivedView ? 'No hay reuniones cerradas.' : 'Todavía no creaste ninguna reunión.'}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:14 }}>
        {list.map(m => (
          <div key={m.id} className="neu-card" style={{ background:'var(--bg-surface)', border:'1px solid var(--border-soft)', borderLeft:`4px solid ${m.color}`, borderRadius:14, padding:16, opacity:archivedView?0.8:1 }}>
            <div onClick={() => !archivedView && onOpenMeeting(m)} style={{ cursor:archivedView?'default':'pointer', marginBottom:10 }}>
              <div className="proj-title" style={{ fontSize:16 }}>{m.name}</div>
              <div style={{ fontSize:11, color:'var(--text-faint)', marginTop:2 }}>Creada el {fmtDate(m.created_at)}</div>
            </div>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', fontSize:12, color:'var(--text-secondary)', marginBottom:12 }}>
              <span>🗂 {m.temas_count} tema{m.temas_count!==1?'s':''}</span>
              <span style={{color:'#f59e0b'}}>📌 {m.tasks_pending} pendiente{m.tasks_pending!==1?'s':''}</span>
              <span style={{color:'#22c55e'}}>✅ {m.tasks_done} hecho{m.tasks_done!==1?'s':''}</span>
              <span>📝 {m.notes_count} nota{m.notes_count!==1?'s':''}</span>
            </div>
            <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
              {!archivedView && <button onClick={() => onOpenMeeting(m)} style={{ ...S.btnPrimary, padding:'6px 12px', fontSize:12 }}>Abrir</button>}
              {!archivedView && <button onClick={() => setEditing({ id:m.id, name:m.name, color:m.color })} style={{ ...S.iconBtn, borderColor:`${m.color}66`, color:m.color }} title="Editar">✏️</button>}
              {!archivedView
                ? <button onClick={() => onConfirm(`¿Cerrar/finalizar "${m.name}"? Podés reabrirla desde "Ver cerradas".`, () => onArchiveMeeting(m.id), { title:'📦 Cerrar reunión', okLabel:'Cerrar', okColor:'#d97706' })} style={{ ...S.iconBtn, borderColor:'#d9770633', color:'#f59e0b' }} title="Cerrar reunión">📦</button>
                : <button onClick={() => onConfirm(`¿Reabrir "${m.name}"?`, () => onUnarchiveMeeting(m.id), { title:'↩ Reabrir reunión', okLabel:'Reabrir', okColor:'#059669' })} style={{ ...S.btnSecondary, padding:'6px 12px', fontSize:12 }}>↩ Reabrir</button>
              }
              <button onClick={() => onConfirm(`¿Eliminar "${m.name}" y TODOS sus temas, tareas y notas? Esta acción no se puede deshacer.`, () => onDeleteMeeting(m.id))} style={{ ...S.iconBtn, borderColor:'#dc262633', color:'#ef4444' }} title="Eliminar">🗑</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
