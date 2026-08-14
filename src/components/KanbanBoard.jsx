import { useState, useEffect, useMemo } from 'react'
import { getStatus, STATUS, fmtDate } from '../utils/helpers.js'

const DAY_NAMES = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']
const FIELD_OPTIONS = [
  { key:'project',     label:'Proyecto' },
  { key:'responsible', label:'Responsable' },
  { key:'status',      label:'Estado' },
  { key:'created_at',  label:'Fecha de registro' },
]
const DEFAULT_FIELDS = ['project','responsible','status']
const FIELDS_KEY = 'ft_kanban_fields'

const toISO = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')

function getWeekDays(offset) {
  const now = new Date()
  const dow = now.getDay() // 0=Dom..6=Sáb
  const diffToMonday = (dow === 0 ? -6 : 1 - dow)
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday + offset*7)
  return Array.from({ length:7 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i))
}

export default function KanbanBoard({ tasks, projects, onToggleTask, onEditTask, onDeleteTask, onMoveTask, onConfirm, onOpenNotes, onAddTask }) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [dragTaskId, setDragTaskId] = useState(null)
  const [hoverCol, setHoverCol] = useState(null)
  const [fieldsOpen, setFieldsOpen] = useState(false)
  const [selectedFields, setSelectedFields] = useState(() => {
    try { return JSON.parse(localStorage.getItem(FIELDS_KEY)) || DEFAULT_FIELDS } catch { return DEFAULT_FIELDS }
  })
  const [addingTaskFor, setAddingTaskFor] = useState(null) // dayISO | 'nodate' | null
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskResponsible, setNewTaskResponsible] = useState('')
  const [newTaskProjectId, setNewTaskProjectId] = useState('')

  useEffect(() => { localStorage.setItem(FIELDS_KEY, JSON.stringify(selectedFields)) }, [selectedFields])

  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset])
  const todayISO = toISO(new Date())

  const columns = useMemo(() => {
    const byDay = {}
    weekDays.forEach(d => { byDay[toISO(d)] = [] })
    const noDate = []
    tasks.forEach(t => {
      const key = t.due_date ? String(t.due_date).slice(0,10) : null
      if (key && byDay[key]) byDay[key].push(t)
      else if (!key) noDate.push(t)
    })
    const sortByStatus = arr => [...arr].sort((a,b) => {
      if (a.done !== b.done) return a.done ? 1 : -1
      return (a.created_at||'') < (b.created_at||'') ? -1 : 1
    })
    return { noDate: sortByStatus(noDate), byDay: Object.fromEntries(Object.entries(byDay).map(([k,v]) => [k, sortByStatus(v)])) }
  }, [tasks, weekDays])

  const toggleField = key => setSelectedFields(prev => prev.includes(key) ? prev.filter(k => k!==key) : [...prev, key])

  const handleDrop = (e, dayISO) => {
    e.preventDefault()
    setHoverCol(null)
    const taskId = Number(e.dataTransfer.getData('text/plain'))
    const task = tasks.find(t => t.id === taskId)
    if (task) onMoveTask(task, dayISO || '')
  }

  const resetNewTaskForm = () => {
    setAddingTaskFor(null)
    setNewTaskTitle('')
    setNewTaskResponsible('')
    setNewTaskProjectId('')
  }

  const submitNewTask = dayISO => {
    if (!newTaskTitle.trim() || !newTaskProjectId) return
    onAddTask(Number(newTaskProjectId), { title:newTaskTitle.trim(), responsible:newTaskResponsible.trim(), due_date:dayISO || '' })
    resetNewTaskForm()
  }

  const weekLabel = `${weekDays[0].getDate()}/${weekDays[0].getMonth()+1} – ${weekDays[6].getDate()}/${weekDays[6].getMonth()+1}/${weekDays[6].getFullYear()}`

  const renderCard = t => {
    const status = getStatus(t.due_date, t.done)
    const cfg = STATUS[status]
    return (
      <div
        key={t.id}
        draggable
        onDragStart={e => { e.dataTransfer.setData('text/plain', String(t.id)); setDragTaskId(t.id) }}
        onDragEnd={() => setDragTaskId(null)}
        style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-soft)', borderLeft:`3px solid ${cfg.border}`, borderRadius:8, padding:'8px 10px', marginBottom:8, cursor:'grab', opacity:dragTaskId===t.id?0.4:1, transition:'opacity .15s' }}
      >
        <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
          <div
            draggable={false}
            onClick={() => onToggleTask(t.id)}
            style={{ width:16, height:16, marginTop:2, borderRadius:4, border:`2px solid ${cfg.badge}`, background:t.done?cfg.badge:'transparent', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, fontSize:10, color:'#0f172a', fontWeight:900 }}>
            {t.done && '✓'}
          </div>
          <div
            draggable={false}
            onClick={() => onOpenNotes(t)}
            title="Ver / agregar notas"
            style={{ flex:1, minWidth:0, fontSize:13, fontWeight:600, textDecoration:t.done?'line-through':'none', color:t.done?'var(--text-faint)':'var(--task-title)', wordBreak:'break-word', cursor:'pointer' }}
          >
            {t.title}
          </div>
          <div
            draggable={false}
            onClick={() => onOpenNotes(t)}
            title="Ver / agregar notas"
            style={{ flexShrink:0, fontSize:10.5, color: t.comments.length ? 'var(--accent)' : 'var(--text-faint)', cursor:'pointer', whiteSpace:'nowrap', padding:'1px 5px', borderRadius:8, background: t.comments.length ? 'var(--bg-hover)' : 'transparent' }}
          >
            💬 {t.comments.length}
          </div>
        </div>
        {selectedFields.length > 0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:5, marginLeft:24, fontSize:10.5, color:'var(--text-muted)' }}>
            {selectedFields.includes('project')     && <span style={{ color:t.projectColor, fontWeight:600 }}>📁 {t.projectName}</span>}
            {selectedFields.includes('responsible') && t.responsible && <span>👤 {t.responsible}</span>}
            {selectedFields.includes('status')      && <span style={{ color:cfg.badge, fontWeight:600 }}>● {cfg.label}</span>}
            {selectedFields.includes('created_at')  && <span>🗓 {fmtDate(t.created_at)}</span>}
          </div>
        )}
        <div draggable={false} style={{ display:'flex', alignItems:'center', gap:6, marginTop:7, marginLeft:24 }}>
          <select
            draggable={false}
            value=""
            onChange={e => {
              const v = e.target.value
              if (v === '') return
              onMoveTask(t, v === '__nodate__' ? '' : v)
            }}
            style={{ flex:1, background:'var(--bg-surface)', border:'1px solid var(--border-soft)', color:'var(--text-secondary)', borderRadius:6, fontSize:10.5, padding:'2px 4px', cursor:'pointer' }}
          >
            <option value="">Mover a...</option>
            <option value="__nodate__">— Sin fecha —</option>
            {weekDays.map(d => <option key={toISO(d)} value={toISO(d)}>{DAY_NAMES[(d.getDay()+6)%7]} {d.getDate()}/{d.getMonth()+1}</option>)}
          </select>
          <button draggable={false} onClick={() => onEditTask(t)} title="Editar tarea" style={{ background:'var(--bg-surface)', border:'1px solid var(--border-soft)', borderRadius:6, cursor:'pointer', fontSize:13, padding:'3px 6px', lineHeight:1 }}>✏️</button>
          <button draggable={false} onClick={() => onConfirm(`¿Eliminar "${t.title}"?`, () => onDeleteTask(t.projectId, t.id))} title="Eliminar" style={{ background:'var(--bg-surface)', border:'1px solid var(--border-soft)', borderRadius:6, cursor:'pointer', fontSize:13, padding:'3px 6px', lineHeight:1 }}>🗑️</button>
        </div>
      </div>
    )
  }

  const renderColumn = (label, dateSubtitle, isToday, isWeekend, list, dayISO) => {
    const columnKey = dayISO ?? 'nodate'
    const isAdding = addingTaskFor === columnKey
    return (
      <div
        key={label}
        className="ft-kanban-col"
        onDragOver={e => { e.preventDefault(); setHoverCol(columnKey) }}
        onDragLeave={() => setHoverCol(prev => prev === columnKey ? null : prev)}
        onDrop={e => handleDrop(e, dayISO)}
        style={{ minWidth:210, width:210, flexShrink:0, background: hoverCol===columnKey ? 'var(--bg-hover)' : (isWeekend ? 'var(--bg-base)' : 'var(--bg-surface)'), border:`1.5px solid ${isToday?'var(--accent)':'var(--border)'}`, borderRadius:12, padding:10, display:'flex', flexDirection:'column', transition:'background .1s' }}
      >
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:6, marginBottom:8 }}>
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:isToday?'var(--accent)':'var(--text-secondary)' }}>{label}</div>
            {dateSubtitle && <div style={{ fontSize:10, color:'var(--text-faint)' }}>{dateSubtitle}</div>}
          </div>
          {!isAdding && (
            <button onClick={() => { resetNewTaskForm(); setAddingTaskFor(columnKey) }} title="Nueva tarea" style={{ flexShrink:0, background:'var(--bg-elevated)', border:'1px solid var(--border-soft)', color:'var(--text-secondary)', borderRadius:6, width:20, height:20, fontSize:13, lineHeight:1, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}>+</button>
          )}
        </div>

        {isAdding && (
          <div style={{ marginBottom:8, background:'var(--bg-elevated)', border:'1px solid var(--border-soft)', borderRadius:8, padding:8, display:'flex', flexDirection:'column', gap:6 }}>
            <select value={newTaskProjectId} onChange={e => setNewTaskProjectId(e.target.value)} style={{ background:'var(--bg-surface)', border:'1px solid var(--border-soft)', color:'var(--text-primary)', borderRadius:6, fontSize:11, padding:'4px 6px', cursor:'pointer' }} autoFocus>
              <option value="">-- Proyecto --</option>
              {[...projects].sort((a,b) => a.name.localeCompare(b.name, 'es', {sensitivity:'base'})).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input placeholder="Descripción *" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} onKeyDown={e => e.key==='Enter' && submitNewTask(dayISO)} style={{ background:'var(--bg-surface)', border:'1px solid var(--border-soft)', color:'var(--text-primary)', borderRadius:6, fontSize:11, padding:'4px 6px' }} />
            <input placeholder="Responsable (opcional)" value={newTaskResponsible} onChange={e => setNewTaskResponsible(e.target.value)} onKeyDown={e => e.key==='Enter' && submitNewTask(dayISO)} style={{ background:'var(--bg-surface)', border:'1px solid var(--border-soft)', color:'var(--text-primary)', borderRadius:6, fontSize:11, padding:'4px 6px' }} />
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={() => submitNewTask(dayISO)} disabled={!newTaskTitle.trim() || !newTaskProjectId} style={{ flex:1, background:'var(--btn-primary)', border:'none', color:'var(--btn-primary-text)', borderRadius:6, fontSize:11, padding:'5px 0', cursor:'pointer', opacity:(!newTaskTitle.trim()||!newTaskProjectId)?0.5:1 }}>Agregar</button>
              <button onClick={resetNewTaskForm} style={{ background:'transparent', border:'1px solid var(--border-soft)', color:'var(--text-secondary)', borderRadius:6, fontSize:11, padding:'5px 10px', cursor:'pointer' }}>✕</button>
            </div>
          </div>
        )}

        <div style={{ flex:1, overflowY:'auto', minHeight:40 }}>
          {list.length === 0 && !isAdding && <div style={{ fontSize:11, color:'var(--text-faint)', textAlign:'center', padding:'10px 0' }}>Sin tareas</div>}
          {list.map(renderCard)}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header: navegación de semana + configurar tarjeta */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10, marginBottom:14 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button onClick={() => setWeekOffset(o => o-1)} style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-soft)', color:'var(--text-secondary)', borderRadius:7, padding:'5px 10px', cursor:'pointer', fontSize:13 }}>‹</button>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', minWidth:130, textAlign:'center' }}>{weekLabel}</div>
          <button onClick={() => setWeekOffset(o => o+1)} style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-soft)', color:'var(--text-secondary)', borderRadius:7, padding:'5px 10px', cursor:'pointer', fontSize:13 }}>›</button>
          {weekOffset !== 0 && <button onClick={() => setWeekOffset(0)} style={{ background:'transparent', border:'1px solid var(--accent)', color:'var(--accent)', borderRadius:7, padding:'5px 10px', cursor:'pointer', fontSize:12 }}>Hoy</button>}
        </div>

        <div style={{ position:'relative' }}>
          <button onClick={() => setFieldsOpen(v => !v)} style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-soft)', color:'var(--text-secondary)', borderRadius:7, padding:'6px 12px', cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', gap:6 }}>
            ⚙ Configurar tarjeta
          </button>
          {fieldsOpen && (
            <>
              <div onClick={() => setFieldsOpen(false)} style={{ position:'fixed', inset:0, zIndex:150 }} />
              <div style={{ position:'absolute', right:0, top:'calc(100% + 6px)', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:10, minWidth:200, boxShadow:'0 10px 30px #0006', zIndex:200, padding:'10px 4px' }}>
                <div style={{ fontSize:11, color:'var(--text-faint)', padding:'2px 12px 8px', textTransform:'uppercase', letterSpacing:0.5 }}>Mostrar en cada tarjeta</div>
                {FIELD_OPTIONS.map(opt => (
                  <label key={opt.key} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px', cursor:'pointer', fontSize:13, color:'var(--text-secondary)' }}>
                    <input type="checkbox" checked={selectedFields.includes(opt.key)} onChange={() => toggleField(opt.key)} style={{ accentColor:'var(--accent)' }} />
                    {opt.label}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Board */}
      <div style={{ display:'flex', gap:10, overflowX:'auto', paddingBottom:8 }}>
        {weekDays.map(d => {
          const iso = toISO(d)
          const isToday = iso === todayISO
          const isWeekend = d.getDay() === 0 || d.getDay() === 6
          return renderColumn(DAY_NAMES[(d.getDay()+6)%7], `${d.getDate()}/${d.getMonth()+1}`, isToday, isWeekend, columns.byDay[iso], iso)
        })}
        {renderColumn('📋 Sin fecha', null, false, false, columns.noDate, null)}
      </div>
    </div>
  )
}
