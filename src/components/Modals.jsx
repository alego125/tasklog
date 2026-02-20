import { useState } from 'react'

const S = {
  input: { background:'#1e293b', border:'1px solid #334155', color:'#e2e8f0', padding:'8px 12px', borderRadius:8, fontSize:13, outline:'none', boxSizing:'border-box', width:'100%' },
  btnPrimary:   { background:'linear-gradient(135deg,#6366f1,#8b5cf6)', border:'none', color:'white', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 },
  btnSecondary: { background:'#1e293b', border:'1px solid #334155', color:'#94a3b8', padding:'8px 14px', borderRadius:8, cursor:'pointer', fontSize:13 },
  btnDanger:    { background:'#dc2626', border:'none', color:'white', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 },
  label: { fontSize:13, color:'#94a3b8', display:'flex', flexDirection:'column', gap:4 },
}

const COLORS = ['#6366f1','#8b5cf6','#ec4899','#14b8a6','#f97316','#06b6d4','#f59e0b','#22c55e']

function Backdrop({ onClose, children }) {
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000b', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#0f172a', border:'1px solid #334155', borderRadius:14, padding:28, width:'100%', maxWidth:480, boxShadow:'0 30px 80px #0009' }}>
        {children}
      </div>
    </div>
  )
}

export function Confirm({ msg, onOk, onCancel }) {
  return (
    <Backdrop onClose={onCancel}>
      <div style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>⚠️ Confirmar eliminación</div>
      <div style={{ fontSize:14, color:'#94a3b8', marginBottom:24 }}>{msg}</div>
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
        <button onClick={onCancel} style={S.btnSecondary}>Cancelar</button>
        <button onClick={onOk} style={S.btnDanger}>Eliminar</button>
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
          <input value={name} onChange={e=>setName(e.target.value)} style={S.input} autoFocus />
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
        <button onClick={()=>onSave(name, color)} style={S.btnPrimary}>Guardar</button>
      </div>
    </Backdrop>
  )
}

export function EditTask({ task, onSave, onClose }) {
  const [f, setF] = useState({ title: task.title, responsible: task.responsible||'', due_date: task.due_date||'' })
  return (
    <Backdrop onClose={onClose}>
      <div style={{ fontSize:16, fontWeight:700, marginBottom:18 }}>✏️ Editar tarea</div>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <label style={S.label}>Título *<input value={f.title} onChange={e=>setF(p=>({...p,title:e.target.value}))} style={S.input} /></label>
        <label style={S.label}>Responsable <span style={{color:'#475569',fontSize:11}}>(opcional)</span><input value={f.responsible} onChange={e=>setF(p=>({...p,responsible:e.target.value}))} style={S.input} /></label>
        <label style={S.label}>Vencimiento <span style={{color:'#475569',fontSize:11}}>(opcional)</span><input type="date" value={f.due_date} onChange={e=>setF(p=>({...p,due_date:e.target.value}))} style={S.input} /></label>
      </div>
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:20 }}>
        <button onClick={onClose} style={S.btnSecondary}>Cancelar</button>
        <button onClick={()=>f.title&&onSave(f)} style={S.btnPrimary}>Guardar</button>
      </div>
    </Backdrop>
  )
}

export function EditComment({ comment, onSave, onClose }) {
  const [text, setText] = useState(comment.text)
  return (
    <Backdrop onClose={onClose}>
      <div style={{ fontSize:16, fontWeight:700, marginBottom:14 }}>✏️ Editar nota</div>
      <textarea value={text} onChange={e=>setText(e.target.value)} rows={4} autoFocus style={{ ...S.input, resize:'vertical', lineHeight:1.6 }} />
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:14 }}>
        <button onClick={onClose} style={S.btnSecondary}>Cancelar</button>
        <button onClick={()=>onSave(text)} style={S.btnPrimary}>Guardar</button>
      </div>
    </Backdrop>
  )
}

export function MoveNoteModal({ note, tasks, onMove, onClose }) {
  const [selectedTask, setSelectedTask] = useState('')
  return (
    <Backdrop onClose={onClose}>
      <div style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>🔀 Mover nota a tarea</div>
      <div style={{ fontSize:13, color:'#94a3b8', marginBottom:16 }}>Seleccioná la tarea donde querés mover esta nota de bitácora:</div>
      <div style={{ background:'#1e293b', borderRadius:8, padding:'10px 12px', marginBottom:16, fontSize:13, color:'#cbd5e1', fontStyle:'italic' }}>"{note.text}"</div>
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
      <div style={{ fontSize:13, color:'#94a3b8', marginBottom:16 }}>Esta nota pasará a la bitácora del proyecto seleccionado:</div>
      <div style={{ background:'#1e293b', borderRadius:8, padding:'10px 12px', marginBottom:16, fontSize:13, color:'#cbd5e1', fontStyle:'italic' }}>"{comment.text}"</div>
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
