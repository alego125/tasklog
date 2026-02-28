// ── Status helpers ────────────────────────────────────────────────
export const getStatus = (due, done) => {
  if (done) return 'done'
  if (!due) return 'ok'
  const dueStr   = String(due).slice(0, 10)
  const today    = new Date()
  const todayStr = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0')
  if (dueStr < todayStr) return 'overdue'
  const diff = (new Date(dueStr + 'T12:00:00') - new Date(todayStr + 'T12:00:00')) / 86400000
  if (diff <= 3) return 'warning'
  return 'ok'
}

export const STATUS = {
  done:    { bg:'#052e16', border:'#16a34a', badge:'#22c55e', label:'Completada' },
  overdue: { bg:'#2d0a0a', border:'#dc2626', badge:'#ef4444', label:'Vencida'    },
  warning: { bg:'#2d1f00', border:'#d97706', badge:'#f59e0b', label:'Por vencer' },
  ok:      { bg:'#0f172a', border:'#334155', badge:'#64748b', label:'Sin vencer' },
}

export const COLORS = ['#6366f1','#8b5cf6','#ec4899','#14b8a6','#f97316','#06b6d4','#f59e0b','#22c55e']

// ── Date formatters ───────────────────────────────────────────────
export const fmtDate = d => {
  if (!d) return ''
  if (d.includes(' ') || d.includes('T')) {
    const date = new Date(d.replace(' ', 'T') + (d.includes('Z') ? '' : 'Z'))
    date.setHours(date.getHours() - 3)
    return date.toISOString().slice(0, 16).replace('T', ' ')
  }
  return d
}

export const fmtSimpleDate = d => {
  if (!d) return ''
  return String(d).slice(0, 10)
}

// ── Shared styles ─────────────────────────────────────────────────
export const S = {
  input:        { background:'var(--bg-elevated)', border:'1px solid var(--border-soft)', color:'var(--text-primary)', padding:'8px 12px', borderRadius:8, fontSize:13, outline:'none', boxSizing:'border-box' },
  select:       { background:'var(--bg-elevated)', border:'1px solid var(--border-soft)', color:'var(--text-primary)', padding:'8px 12px', borderRadius:8, fontSize:13, outline:'none', cursor:'pointer' },
  btnPrimary:   { background:'linear-gradient(135deg,#6366f1,#8b5cf6)', border:'none', color:'white', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600, whiteSpace:'nowrap' },
  btnSecondary: { background:'var(--bg-elevated)', border:'1px solid var(--border-soft)', color:'var(--text-secondary)', padding:'8px 14px', borderRadius:8, cursor:'pointer', fontSize:13, whiteSpace:'nowrap' },
  iconBtn:      { background:'transparent', border:'1px solid var(--border-soft)', color:'var(--text-secondary)', width:28, height:28, borderRadius:6, cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', padding:0, flexShrink:0 },
}

// ── Excel export ──────────────────────────────────────────────────
export function exportExcel(projects) {
  const esc  = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
  const cell = (v, type='String') => `<Cell><Data ss:Type="${type}">${esc(v)}</Data></Cell>`
  const row  = cells => `<Row>${cells.join('')}</Row>`
  const sheets = []

  sheets.push(`<Worksheet ss:Name="Proyectos"><Table>${[
    row([cell('ID'),cell('Nombre'),cell('Color'),cell('Fecha creación'),cell('Tareas totales'),cell('Completadas'),cell('Notas')]),
    ...projects.map(p => row([cell(p.id,'Number'),cell(p.name),cell(p.color),cell(fmtDate(p.created_at)),cell(p.tasks.length,'Number'),cell(p.tasks.filter(t=>t.done).length,'Number'),cell(p.notes?.length||0,'Number')]))
  ].join('')}</Table></Worksheet>`)

  sheets.push(`<Worksheet ss:Name="Tareas"><Table>${[
    row([cell('ID'),cell('Proyecto'),cell('Título'),cell('Responsable'),cell('Fecha registro'),cell('Vencimiento'),cell('Estado'),cell('Completada'),cell('Fecha completado'),cell('Comentarios')]),
    ...projects.flatMap(p => p.tasks.map(t => row([cell(t.id,'Number'),cell(p.name),cell(t.title),cell(t.responsible||''),cell(fmtDate(t.created_at)),cell(fmtSimpleDate(t.due_date)),cell(STATUS[getStatus(t.due_date,t.done)].label),cell(t.done?'Sí':'No'),cell(t.done_at||''),cell(t.comments.length,'Number')])))
  ].join('')}</Table></Worksheet>`)

  sheets.push(`<Worksheet ss:Name="Notas de Proyecto"><Table>${[
    row([cell('ID'),cell('Proyecto'),cell('Autor'),cell('Fecha'),cell('Nota')]),
    ...projects.flatMap(p => (p.notes||[]).map(n => row([cell(n.id,'Number'),cell(p.name),cell(n.author||''),cell(fmtDate(n.created_at)),cell(n.text)])))
  ].join('')}</Table></Worksheet>`)

  sheets.push(`<Worksheet ss:Name="Comentarios"><Table>${[
    row([cell('ID'),cell('Proyecto'),cell('Tarea'),cell('Autor'),cell('Fecha'),cell('Comentario')]),
    ...projects.flatMap(p => p.tasks.flatMap(t => t.comments.map(c => row([cell(c.id,'Number'),cell(p.name),cell(t.title),cell(c.author||''),cell(fmtDate(c.created_at)),cell(c.text)]))))
  ].join('')}</Table></Worksheet>`)

  const xml  = `<?xml version="1.0" encoding="UTF-8"?>\n<?mso-application progid="Excel.Sheet"?>\n<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Default"><Font ss:Bold="0"/></Style></Styles>${sheets.join('')}</Workbook>`
  const blob = new Blob([xml], { type:'application/vnd.ms-excel;charset=utf-8' })
  const a    = document.createElement('a')
  a.href     = URL.createObjectURL(blob)
  a.download = `FlowTracker_${new Date().toISOString().split('T')[0]}.xls`
  a.click()
  URL.revokeObjectURL(a.href)
}
