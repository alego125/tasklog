// ── Status helpers ────────────────────────────────────────────────
export const getStatus = (due, done) => {
  if (done) return 'done'
  if (!due) return 'ok'
  const dueStr   = String(due).slice(0, 10)
  const today    = new Date()
  const todayStr = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0')
  if (dueStr <= todayStr) return 'overdue'
  const diff = (new Date(dueStr + 'T12:00:00') - new Date(todayStr + 'T12:00:00')) / 86400000
  if (diff <= 3) return 'warning'
  return 'ok'
}

export const STATUS = {
  done:    { bg:'#edf5ee', border:'#b0cdb2', badge:'#7a9e7e', label:'Completada' },
  overdue: { bg:'#f5edec', border:'#cba8a8', badge:'#dc2626', label:'Vencida'    },
  warning: { bg:'#faf0e6', border:'#c8a888', badge:'#eab308', label:'Por vencer' },
  ok:      { bg:'transparent', border:'#ddd5c5', badge:'#9c8e82', label:'Sin vencer' },
}

export const COLORS = ['#7a9e7e','#c4784a','#4a8ea0','#9a7a5a','#887ab0','#4a8a70','#b07840','#7a8a4a']

// ── Date formatters ───────────────────────────────────────────────
export const fmtDate = d => {
  if (!d) return ''
  if (String(d).includes(' ') || String(d).includes('T')) {
    const date = new Date(String(d).replace(' ', 'T') + (String(d).includes('Z') ? '' : 'Z'))
    date.setHours(date.getHours() - 3)
    const dd = String(date.getDate()).padStart(2,'0')
    const mm = String(date.getMonth()+1).padStart(2,'0')
    const yy = date.getFullYear()
    const hh = String(date.getHours()).padStart(2,'0')
    const min = String(date.getMinutes()).padStart(2,'0')
    return dd + '/' + mm + '/' + yy + ' ' + hh + ':' + min
  }
  // Solo fecha YYYY-MM-DD → dd/mm/yyyy
  const parts = String(d).slice(0,10).split('-')
  if (parts.length === 3) return parts[2] + '/' + parts[1] + '/' + parts[0]
  return d
}

export const fmtSimpleDate = d => {
  if (!d) return ''
  const parts = String(d).slice(0,10).split('-')
  if (parts.length === 3) return parts[2] + '/' + parts[1] + '/' + parts[0]
  return String(d).slice(0,10)
}

// ── Shared styles ─────────────────────────────────────────────────
export const S = {
  input:        { background:'var(--bg-elevated)', border:'1px solid var(--border-soft)', color:'var(--text-primary)', padding:'8px 12px', borderRadius:8, fontSize:13, outline:'none', boxSizing:'border-box' },
  select:       { background:'var(--bg-elevated)', border:'1px solid var(--border-soft)', color:'var(--text-primary)', padding:'8px 12px', borderRadius:8, fontSize:13, outline:'none', cursor:'pointer' },
  btnPrimary:   { background:'var(--btn-primary)', border:'none', color:'var(--btn-primary-text)', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600, whiteSpace:'nowrap' },
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

// ── AI Report Prompt export ──────────────────────────────────────
export function exportPDF(projects) {
  const fmtD = d => {
    if (!d) return '—'
    const parts = String(d).slice(0,10).split('-')
    return parts.length === 3 ? parts[2]+'/'+parts[1]+'/'+parts[0] : String(d).slice(0,10)
  }
  const statusLabel = (due, done) => {
    if (done) return 'Completada'
    if (!due)  return 'Sin fecha de vencimiento'
    const dueStr   = String(due).slice(0,10)
    const today    = new Date()
    const todayStr = today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0')
    if (dueStr <= todayStr) return 'VENCIDA'
    const diff = (new Date(dueStr+'T12:00:00') - new Date(todayStr+'T12:00:00')) / 86400000
    if (diff <= 3) return 'Por vencer (próximos 3 días)'
    return 'A tiempo'
  }

  const now = new Date()
  const fecha = String(now.getDate()).padStart(2,'0')+'/'+String(now.getMonth()+1).padStart(2,'0')+'/'+now.getFullYear()
  const activeProjects = projects.filter(p => !p.archived)

  let lines = []
  lines.push(`PROMPT PARA GENERACIÓN DE INFORME — CURSOR APP`)
  lines.push(`Fecha de generación: ${fecha}`)
  lines.push(``)
  lines.push(`---`)
  lines.push(``)
  lines.push(`Sos un asistente de gestión de proyectos. A continuación te proporciono los datos actuales de todos los proyectos activos de la aplicación Cursor. Tu tarea es generar un informe ejecutivo completo, visualmente organizado y fácil de leer, que incluya:`)
  lines.push(``)
  lines.push(`1. Un resumen general del estado de todos los proyectos`)
  lines.push(`2. Un análisis detallado de cada proyecto con sus tareas, responsables y estado`)
  lines.push(`3. Alertas de tareas vencidas o por vencer`)
  lines.push(`4. Un resumen de las notas y bitácoras más relevantes`)
  lines.push(`5. Conclusiones y recomendaciones de acción inmediata`)
  lines.push(``)
  lines.push(`Usá formato Markdown con encabezados, tablas, listas y emojis para que sea visualmente agradable.`)
  lines.push(``)
  lines.push(`---`)
  lines.push(``)
  lines.push(`## DATOS DE LOS PROYECTOS`)
  lines.push(``)
  lines.push(`Total de proyectos activos: ${activeProjects.length}`)
  lines.push(``)

  for (const p of activeProjects) {
    const pending   = p.tasks.filter(t => !t.done)
    const done      = p.tasks.filter(t => t.done)
    const overdue   = pending.filter(t => statusLabel(t.due_date, t.done) === 'VENCIDA')
    const warning   = pending.filter(t => statusLabel(t.due_date, t.done).startsWith('Por vencer'))

    lines.push(`### PROYECTO: ${p.name}`)
    lines.push(`- Tareas pendientes: ${pending.length}`)
    lines.push(`- Tareas completadas: ${done.length}`)
    lines.push(`- Tareas vencidas: ${overdue.length}`)
    lines.push(`- Tareas por vencer (próx. 3 días): ${warning.length}`)
    lines.push(`- Notas del proyecto: ${p.notes?.length||0}`)
    lines.push(``)

    if (p.tasks.length > 0) {
      lines.push(`#### Tareas:`)
      for (const t of p.tasks) {
        lines.push(``)
        lines.push(`  TAREA: ${t.title}`)
        lines.push(`  - Estado: ${statusLabel(t.due_date, t.done)}`)
        lines.push(`  - Responsable: ${t.responsible || '—'}`)
        lines.push(`  - Fecha de registro: ${fmtD(t.created_at)}`)
        lines.push(`  - Fecha de vencimiento: ${t.due_date ? fmtD(t.due_date) : '—'}`)
        if (t.comments && t.comments.length > 0) {
          lines.push(`  - Bitácora (${t.comments.length} entrada${t.comments.length!==1?'s':''}):`)
          for (const c of t.comments) {
            lines.push(`    [${fmtD(c.created_at)} — ${c.author||'—'}]: ${c.text}`)
          }
        }
      }
      lines.push(``)
    }

    if (p.notes && p.notes.length > 0) {
      lines.push(`#### Notas del proyecto:`)
      for (const n of p.notes) {
        lines.push(`  [${fmtD(n.created_at)} — ${n.author||'—'}]: ${n.text}`)
      }
      lines.push(``)
    }

    lines.push(`---`)
    lines.push(``)
  }

  lines.push(`FIN DE LOS DATOS. Generá el informe ahora.`)

  const text = lines.join('\n')
  const blob = new Blob([text], { type:'text/plain;charset=utf-8' })
  const a    = document.createElement('a')
  a.href     = URL.createObjectURL(blob)
  a.download = `cursor_prompt_informe_${fecha.replace(/\//g,'-')}.txt`
  a.click()
  URL.revokeObjectURL(a.href)
}