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
  done:    { bg:'#052e16', border:'#16a34a', badge:'#22c55e', label:'Completada' },
  overdue: { bg:'#2d0a0a', border:'#dc2626', badge:'#ef4444', label:'Vencida'    },
  warning: { bg:'#2d1f00', border:'#d97706', badge:'#f59e0b', label:'Por vencer' },
  ok:      { bg:'#0f172a', border:'#334155', badge:'#64748b', label:'Sin vencer' },
}

export const COLORS = ['#6366f1','#8b5cf6','#ec4899','#14b8a6','#f97316','#06b6d4','#f59e0b','#22c55e']

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

// ── PDF export ────────────────────────────────────────────────────
export async function exportPDF(projects) {
  // Carga jsPDF dinámicamente desde CDN
  if (!window.jspdf) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
      s.onload = resolve
      s.onerror = reject
      document.head.appendChild(s)
    })
  }
  const { jsPDF } = window.jspdf
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' })
  const PW = 210, ML = 14, MR = 196, LH = 6
  let y = 0

  const checkPage = (need = 10) => {
    if (y + need > 280) { doc.addPage(); y = 16 }
  }

  const header = () => {
    doc.setFillColor(30, 36, 51)
    doc.rect(0, 0, PW, 18, 'F')
    doc.setFontSize(14); doc.setFont('helvetica','bold'); doc.setTextColor(168, 209, 112)
    doc.text('Cursor — Reporte de Proyectos', ML, 12)
    doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(148, 163, 184)
    const now = new Date()
    const dd = String(now.getDate()).padStart(2,'0')
    const mm = String(now.getMonth()+1).padStart(2,'0')
    doc.text(`${dd}/${mm}/${now.getFullYear()}`, MR, 12, { align:'right' })
    y = 24
  }

  const statusLabel = (due, done) => {
    if (done) return { label:'Completada', r:34,  g:197, b:94  }
    if (!due)  return { label:'Sin fecha',  r:100, g:116, b:139 }
    const dueStr   = String(due).slice(0,10)
    const today    = new Date()
    const todayStr = today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0')
    if (dueStr <= todayStr) return { label:'Vencida',    r:239, g:68,  b:68  }
    const diff = (new Date(dueStr+'T12:00:00') - new Date(todayStr+'T12:00:00')) / 86400000
    if (diff <= 3)          return { label:'Por vencer', r:245, g:158, b:11  }
    return                          { label:'A tiempo',  r:100, g:116, b:139 }
  }

  const fmtD = d => {
    if (!d) return '—'
    const parts = String(d).slice(0,10).split('-')
    return parts.length === 3 ? parts[2]+'/'+parts[1]+'/'+parts[0] : String(d).slice(0,10)
  }

  header()

  const activeProjects = projects.filter(p => !p.archived)

  for (const project of activeProjects) {
    checkPage(20)

    // ── Proyecto header ──
    const hex = project.color || '#6366f1'
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
    doc.setFillColor(r, g, b, 0.15)
    doc.roundedRect(ML, y, MR-ML, 10, 2, 2, 'F')
    doc.setDrawColor(r, g, b)
    doc.setLineWidth(0.8)
    doc.line(ML, y, ML, y+10)
    doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(r, g, b)
    doc.text(project.name, ML+4, y+7)
    const pendientes = project.tasks.filter(t=>!t.done).length
    const completadas = project.tasks.filter(t=>t.done).length
    doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(148,163,184)
    doc.text(`${pendientes} pendiente${pendientes!==1?'s':''} · ${completadas} completada${completadas!==1?'s':''} · ${project.notes?.length||0} nota${(project.notes?.length||0)!==1?'s':''}`, MR, y+7, { align:'right' })
    y += 13

    // ── Tareas ──
    if (project.tasks.length === 0) {
      checkPage(8)
      doc.setFontSize(8); doc.setFont('helvetica','italic'); doc.setTextColor(100,116,139)
      doc.text('Sin tareas.', ML+4, y+4)
      y += 8
    }

    for (const task of project.tasks) {
      checkPage(14)
      const st = statusLabel(task.due_date, task.done)

      // Badge de estado
      doc.setFillColor(st.r, st.g, st.b)
      doc.setDrawColor(st.r, st.g, st.b)
      doc.roundedRect(ML+2, y+1, 22, 5, 1, 1, 'F')
      doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255)
      doc.text(st.label, ML+13, y+4.5, { align:'center' })

      // Título
      doc.setFontSize(9); doc.setFont('helvetica', task.done ? 'normal' : 'bold')
      doc.setTextColor(task.done ? 100 : 233, task.done ? 116 : 236, task.done ? 139 : 239)
      const titleLines = doc.splitTextToSize(task.title, 110)
      doc.text(titleLines, ML+27, y+5)
      const titleH = titleLines.length * LH

      // Meta: responsable y fechas
      doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor(100,116,139)
      const meta = [
        task.responsible ? `👤 ${task.responsible}` : null,
        task.due_date    ? `📅 Vence: ${fmtD(task.due_date)}` : null,
        `🗓 Registro: ${fmtD(task.created_at)}`
      ].filter(Boolean).join('   ')
      doc.text(meta, ML+27, y+5+titleH)
      y += Math.max(titleH + LH + 3, 12)

      // ── Bitácora ──
      if (task.comments && task.comments.length > 0) {
        for (const c of task.comments) {
          checkPage(10)
          doc.setFillColor(15, 23, 42)
          doc.roundedRect(ML+6, y, MR-ML-6, 0, 1, 1, 'F')
          doc.setDrawColor(51, 65, 85)
          doc.setLineWidth(0.3)
          doc.line(ML+8, y, ML+8, y+1) // será reemplazado por altura real

          doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(100,116,139)
          doc.text(`${c.author||'—'}  ·  ${fmtD(c.created_at)}`, ML+11, y+4)

          doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(203,213,225)
          const lines = doc.splitTextToSize(c.text, MR-ML-20)
          doc.text(lines, ML+11, y+9)
          const h = 10 + lines.length * 4.5
          doc.setFillColor(30, 41, 59)
          doc.roundedRect(ML+6, y, MR-ML-6, h, 1, 1, 'F')
          doc.setLineWidth(0.4); doc.setDrawColor(71, 85, 105)
          doc.roundedRect(ML+6, y, MR-ML-6, h, 1, 1, 'S')
          // redibuja texto encima del rect
          doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(100,116,139)
          doc.text(`${c.author||'—'}  ·  ${fmtD(c.created_at)}`, ML+11, y+4)
          doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(203,213,225)
          doc.text(lines, ML+11, y+9)
          y += h + 3
        }
      }
    }

    // ── Notas del proyecto ──
    if (project.notes && project.notes.length > 0) {
      checkPage(10)
      doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(129,140,248)
      doc.text('📝 Notas del proyecto', ML+2, y+4)
      y += 7
      for (const note of project.notes) {
        checkPage(10)
        doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(100,116,139)
        doc.text(`${note.author||'—'}  ·  ${fmtD(note.created_at)}`, ML+4, y+4)
        doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(203,213,225)
        const lines = doc.splitTextToSize(note.text, MR-ML-10)
        doc.text(lines, ML+4, y+9)
        y += 9 + lines.length * 4.5 + 3
      }
    }

    y += 8
    // Línea separadora entre proyectos
    checkPage(4)
    doc.setDrawColor(30, 36, 51); doc.setLineWidth(0.3)
    doc.line(ML, y-4, MR, y-4)
  }

  // Pie de página en todas las páginas
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor(71,85,105)
    doc.text(`Página ${i} de ${pageCount}`, PW/2, 291, { align:'center' })
  }

  const now = new Date()
  const dd = String(now.getDate()).padStart(2,'0')
  const mm = String(now.getMonth()+1).padStart(2,'0')
  doc.save(`cursor_reporte_${dd}-${mm}-${now.getFullYear()}.pdf`)
}
