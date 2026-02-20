import { useState } from 'react'

const S = {
  input: { background:'#1e293b', border:'1px solid #334155', color:'#e2e8f0', padding:'8px 12px', borderRadius:8, fontSize:13, outline:'none', boxSizing:'border-box', width:'100%' },
  btnPrimary:   { background:'linear-gradient(135deg,#6366f1,#8b5cf6)', border:'none', color:'white', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 },
  btnSecondary: { background:'#1e293b', border:'1px solid #334155', color:'#94a3b8', padding:'8px 14px', borderRadius:8, cursor:'pointer', fontSize:13 },
  label: { fontSize:13, color:'#94a3b8', display:'flex', flexDirection:'column', gap:4 },
}

function Backdrop({ onClose, children }) {
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000b', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#0f172a', border:'1px solid #334155', borderRadius:14, padding:28, width:'100%', maxWidth:460, boxShadow:'0 30px 80px #0009' }}>
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
        <button onClick={onOk} style={{ ...S.btnPrimary, background:'#dc2626' }}>Eliminar</button>
      </div>
    </Backdrop>
  )
}

export function EditTask({ task, onSave, onClose }) {
  const [f, setF] = useState({ title: task.title, responsible: task.responsible || '', due_date: task.due_date })
  return (
    <Backdrop onClose={onClose}>
      <div style={{ fontSize:16, fontWeight:700, marginBottom:18 }}>✏️ Editar tarea</div>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <label style={S.label}>Título<input value={f.title} onChange={e=>setF(p=>({...p,title:e.target.value}))} style={S.input} /></label>
        <label style={S.label}>Responsable<input value={f.responsible} onChange={e=>setF(p=>({...p,responsible:e.target.value}))} style={S.input} /></label>
        <label style={S.label}>Vencimiento<input type="date" value={f.due_date} onChange={e=>setF(p=>({...p,due_date:e.target.value}))} style={S.input} /></label>
      </div>
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:20 }}>
        <button onClick={onClose} style={S.btnSecondary}>Cancelar</button>
        <button onClick={()=>onSave(f)} style={S.btnPrimary}>Guardar</button>
      </div>
    </Backdrop>
  )
}

export function EditComment({ comment, onSave, onClose }) {
  const [text, setText] = useState(comment.text)
  return (
    <Backdrop onClose={onClose}>
      <div style={{ fontSize:16, fontWeight:700, marginBottom:14 }}>✏️ Editar nota</div>
      <textarea value={text} onChange={e=>setText(e.target.value)} rows={4} autoFocus
        style={{ ...S.input, resize:'vertical', lineHeight:1.6 }} />
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:14 }}>
        <button onClick={onClose} style={S.btnSecondary}>Cancelar</button>
        <button onClick={()=>onSave(text)} style={S.btnPrimary}>Guardar</button>
      </div>
    </Backdrop>
  )
}
