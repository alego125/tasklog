import { useState } from 'react'

const S = {
  input: { background:'var(--input-bg)', border:'1px solid var(--border-soft)', color:'var(--text-primary)', padding:'8px 12px', borderRadius:8, fontSize:13, outline:'none', boxSizing:'border-box', width:'100%' },
  btnPrimary:   { background:'var(--btn-primary)', border:'none', color:'var(--btn-primary-text)', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 },
  btnSecondary: { background:'var(--bg-elevated)', border:'1px solid var(--border-soft)', color:'var(--text-secondary)', padding:'8px 14px', borderRadius:8, cursor:'pointer', fontSize:13 },
  btnDanger:    { background:'#dc2626', border:'none', color:'white', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 },
  label: { fontSize:13, color:'var(--text-secondary)', display:'flex', flexDirection:'column', gap:4 },
}

const COLORS = ['#22c55e','#A8D170','#06b6d4','#7BC6D9','#6366f1','#8b5cf6','#ec4899','#f97316','#f59e0b','#14b8a6']

function Backdrop({ onClose, children }) {
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000b', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'var(--bg-surface)', border:'1px solid var(--border-soft)', borderRadius:14, padding:28, width:'100%', maxWidth:480, boxShadow:'0 30px 80px #0009' }}>
        {children}
      </div>
    </div>
  )
}

export function Confirm({ msg, onOk, onCancel, title, okLabel, okColor }) {
  const btnStyle = { ...S.btnDanger, background: okColor || '#dc2626' }
  return (
    <Backdrop onClose={onCancel}>
      <div style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>{title || '⚠️ Confirmar eliminación'}</div>
      <div style={{ fontSize:14, color:'var(--text-secondary)', marginBottom:24 }}>{msg}</div>
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
        <button onClick={onCancel} style={S.btnSecondary}>Cancelar</button>
        <button onClick={onOk} style={btnStyle}>{okLabel || 'Eliminar'}</button>
      </div>
    </Backdrop>
  )
}

export function EditProject({ project, onSave, onClose }) {
  const [name, setName]   = useState(project.name)
  const [color, setColor] = useState(project.color)
  return (
    <Backdrop onClose={onClose}>
      <div style={{ fontSize:16, fontWeight:700, marginBottom:18 }}>✏️ Editar proyecto</div>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <label style={S.label}>Nombre del proyecto
          <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&name.trim()&&onSave(name,color)} style={S.input} autoFocus />
        </label>
        <label style={S.label}>Color
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:4 }}>
            {COLORS.map(c=>(
              <div key={c} onClick={()=>setColor(c)} style={{ width:26, height:26, borderRadius:'50%', background:c, cursor:'pointer', border:color===c?'3px solid white':'3px solid transparent', boxSizing:'border-box', transition:'border .15s' }} />
            ))}
          </div>
        </label>
      </div>
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:22 }}>
        <button onClick={onClose} style={S.btnSecondary}>Cancelar</button>
        <button onClick={()=>name.trim()&&onSave(name, color)} style={S.btnPrimary}>Guardar</button>
      </div>
    </Backdrop>
  )
}

// Aplica la misma corrección de -3hs que fmtDate para mostrar la fecha local correcta
function toLocalDate(d) {
  if (!d) return ''
  if (String(d).includes('T') || String(d).includes(' ')) {
    const date = new Date(String(d).replace(' ', 'T') + (String(d).includes('Z') ? '' : 'Z'))
    date.setHours(date.getHours() - 3)
    return date.toISOString().slice(0, 10)
  }
  return String(d).slice(0, 10)
}

export function EditTask({ task, onSave, onClose }) {
  const currentYear = new Date().getFullYear()
  // Parsear due_date existente en partes dd/mm/yyyy
  const parseDue = (d) => {
    if (!d) return { day:'', month:'', year: String(currentYear) }
    const parts = String(d).slice(0,10).split('-')
    return { year: parts[0]||String(currentYear), month: parts[1]||'', day: parts[2]||'' }
  }
  const [f, setF] = useState({
    title:       task.title,
    responsible: task.responsible||'',
    created_at:  toLocalDate(task.created_at),
  })
  const [due, setDue] = useState(parseDue(task.due_date))

  const buildDueDate = () => {
    if (!due.day && !due.month) return ''
    const d = due.day.padStart(2,'0') || '01'
    const m = due.month.padStart(2,'0') || '01'
    const y = due.year || String(currentYear)
    return y + '-' + m + '-' + d
  }
  const save = () => f.title && onSave({ ...f, due_date: buildDueDate() })

  const inputNum = (max, val, setter) => {
    const n = val.replace(/\D/g,'').slice(0,max===31?2:max===12?2:4)
    setter(n)
  }

  return (
    <Backdrop onClose={onClose}>
      <div style={{ fontSize:16, fontWeight:700, marginBottom:18 }}>✏️ Editar tarea</div>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <label style={S.label}>Descripción tarea *<input value={f.title} onChange={e=>setF(p=>({...p,title:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&save()} style={S.input} autoFocus /></label>
        <label style={S.label}>Responsable <span style={{color:'var(--text-faint)',fontSize:11}}>(opcional)</span><input value={f.responsible} onChange={e=>setF(p=>({...p,responsible:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&save()} style={S.input} /></label>
        <label style={S.label}>Vencimiento <span style={{color:'var(--text-faint)',fontSize:11}}>(opcional)</span>
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            <input value={due.day}   onChange={e=>inputNum(31, e.target.value, v=>setDue(p=>({...p,day:v})))}   placeholder="DD"   maxLength={2} style={{ ...S.input, width:60, textAlign:'center' }} />
            <span style={{color:'var(--text-muted)'}}>/</span>
            <input value={due.month} onChange={e=>inputNum(12, e.target.value, v=>setDue(p=>({...p,month:v})))} placeholder="MM"   maxLength={2} style={{ ...S.input, width:60, textAlign:'center' }} />
            <span style={{color:'var(--text-muted)'}}>/</span>
            <input value={due.year}  onChange={e=>inputNum(9999, e.target.value, v=>setDue(p=>({...p,year:v})))}  placeholder="AAAA" maxLength={4} style={{ ...S.input, width:80, textAlign:'center' }} />
          </div>
        </label>
        <label style={S.label}>Fecha de registro <span style={{color:'var(--text-faint)',fontSize:11}}>(opcional)</span><input type="date" value={f.created_at} onChange={e=>setF(p=>({...p,created_at:e.target.value}))} style={S.input} /></label>
      </div>
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:20 }}>
        <button onClick={onClose} style={S.btnSecondary}>Cancelar</button>
        <button onClick={save} style={S.btnPrimary}>Guardar</button>
      </div>
    </Backdrop>
  )
}

export function EditComment({ comment, onSave, onClose }) {
  const [text, setText] = useState(comment.text)
  const [createdAt, setCreatedAt] = useState(comment.created_at ? String(comment.created_at).slice(0,10) : '')
  return (
    <Backdrop onClose={onClose}>
      <div style={{ fontSize:16, fontWeight:700, marginBottom:14 }}>✏️ Editar nota</div>
      <textarea value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&e.ctrlKey&&onSave({text,created_at:createdAt})} rows={4} autoFocus style={{ ...S.input, resize:'vertical', lineHeight:1.6 }} />
      <label style={{ ...S.label, marginTop:10 }}>Fecha de registro <span style={{color:'var(--text-faint)',fontSize:11}}>(opcional)</span><input type="date" value={createdAt} onChange={e=>setCreatedAt(e.target.value)} style={S.input} /></label>
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:14 }}>
        <button onClick={onClose} style={S.btnSecondary}>Cancelar</button>
        <button onClick={()=>onSave({text,created_at:createdAt})} style={S.btnPrimary}>Guardar</button>
      </div>
    </Backdrop>
  )
}

export function MoveNoteModal({ note, tasks, onMove, onClose }) {
  const [selectedTask, setSelectedTask] = useState('')
  return (
    <Backdrop onClose={onClose}>
      <div style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>🔀 Mover nota a tarea</div>
      <div style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:16 }}>Seleccioná la tarea donde querés mover esta nota de bitácora:</div>
      <div style={{ background:'var(--bg-elevated)', borderRadius:8, padding:'10px 12px', marginBottom:16, fontSize:13, color:'#cbd5e1', fontStyle:'italic' }}>"{note.text}"</div>
      <select value={selectedTask} onChange={e=>setSelectedTask(e.target.value)} style={{ ...S.input, marginBottom:20, cursor:'pointer' }}>
        <option value="">-- Seleccioná una tarea --</option>
        {tasks.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}
      </select>
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
        <button onClick={onClose} style={S.btnSecondary}>Cancelar</button>
        <button onClick={()=>selectedTask&&onMove(Number(selectedTask))} style={S.btnPrimary} disabled={!selectedTask}>Mover</button>
      </div>
    </Backdrop>
  )
}

export function MoveCommentModal({ comment, projects, currentProjectId, onMove, onClose }) {
  const [selectedProject, setSelectedProject] = useState('')
  return (
    <Backdrop onClose={onClose}>
      <div style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>🔀 Mover nota a proyecto</div>
      <div style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:16 }}>Esta nota pasará a la bitácora del proyecto seleccionado:</div>
      <div style={{ background:'var(--bg-elevated)', borderRadius:8, padding:'10px 12px', marginBottom:16, fontSize:13, color:'#cbd5e1', fontStyle:'italic' }}>"{comment.text}"</div>
      <select value={selectedProject} onChange={e=>setSelectedProject(e.target.value)} style={{ ...S.input, marginBottom:20, cursor:'pointer' }}>
        <option value="">-- Seleccioná un proyecto --</option>
        {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
        <button onClick={onClose} style={S.btnSecondary}>Cancelar</button>
        <button onClick={()=>selectedProject&&onMove(Number(selectedProject))} style={S.btnPrimary} disabled={!selectedProject}>Mover</button>
      </div>
    </Backdrop>
  )
}
