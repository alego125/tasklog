import { useMemo, useState } from 'react'
import { getStatus, STATUS, fmtSimpleDate } from '../utils/helpers.js'

const DONUT_R = 62
const DONUT_C = 2 * Math.PI * DONUT_R
const SEGMENT_KEYS = ['overdue', 'warning', 'ok', 'done']

export default function Dashboard({ projects, filterProject, onSetFilterProject, onDrillTasks, onDrillProject }) {
  const [hoverSeg, setHoverSeg] = useState(null)
  const [hoverBar, setHoverBar] = useState(null)

  const scoped = useMemo(() => (
    filterProject === 'all' ? projects : projects.filter(p => String(p.id) === filterProject)
  ), [projects, filterProject])

  const stats = useMemo(() => {
    const allTasks = scoped.flatMap(p => p.tasks.map(t => ({ ...t, projectId:p.id, projectName:p.name, projectColor:p.color })))
    const byStatus = { overdue:[], warning:[], ok:[], done:[] }
    allTasks.forEach(t => byStatus[getStatus(t.due_date, t.done)].push(t))
    const total = allTasks.length
    const completionRate = total ? Math.round(byStatus.done.length / total * 100) : 0
    return {
      allTasks, byStatus, total, completionRate,
      activeProjects: scoped.filter(p => !p.archived).length,
      pending: total - byStatus.done.length,
    }
  }, [scoped])

  const upcoming = useMemo(() =>
    [...stats.byStatus.warning, ...stats.byStatus.ok.filter(t => t.due_date)]
      .sort((a,b) => (a.due_date||'') < (b.due_date||'') ? -1 : 1)
      .slice(0, 6)
  , [stats])

  const overdueList = useMemo(() =>
    [...stats.byStatus.overdue].sort((a,b) => (a.due_date||'') < (b.due_date||'') ? -1 : 1).slice(0, 6)
  , [stats])

  const perProject = useMemo(() => scoped.map(p => {
    const counts = { overdue:0, warning:0, ok:0, done:0 }
    p.tasks.forEach(t => counts[getStatus(t.due_date, t.done)]++)
    const pendingCount = counts.overdue + counts.warning + counts.ok
    return { id:p.id, name:p.name, color:p.color, counts, total:p.tasks.length, pendingCount }
  }).sort((a,b) => b.pendingCount - a.pendingCount).slice(0, 8), [scoped])

  const maxPending = Math.max(1, ...perProject.map(p => p.pendingCount))

  let cumulative = 0
  const donutSegments = SEGMENT_KEYS.map(key => {
    const count = stats.byStatus[key].length
    const frac  = stats.total ? count / stats.total : 0
    const seg   = { key, count, frac, offset:cumulative, color:STATUS[key].badge, label:STATUS[key].label }
    cumulative += frac
    return seg
  })

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
        <div style={{ fontSize:18, fontWeight:700 }}>📊 Dashboard — Informe detallado</div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:11, color:'var(--accent)', display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent)', display:'inline-block' }} /> Datos en tiempo real
          </span>
          {filterProject !== 'all' && (
            <button onClick={() => onSetFilterProject('all')} style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-soft)', color:'var(--text-secondary)', padding:'4px 10px', borderRadius:7, cursor:'pointer', fontSize:12 }}>
              ✕ Quitar filtro de proyecto
            </button>
          )}
        </div>
      </div>

      {stats.byStatus.overdue.length > 0 && (
        <div onClick={() => onDrillTasks('overdue')} style={{ background:'#2d0a0a', border:'1px solid #dc2626', borderRadius:12, padding:'14px 18px', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
          <span style={{ fontSize:22 }}>⚠️</span>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:'#ef4444' }}>{stats.byStatus.overdue.length} tarea{stats.byStatus.overdue.length!==1?'s':''} vencida{stats.byStatus.overdue.length!==1?'s':''}</div>
            <div style={{ fontSize:12, color:'#f5b8b8' }}>Requieren atención inmediata — click para ver el listado</div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:10 }}>
        {[
          { label:'Proyectos activos', val:stats.activeProjects,          color:'#7BC6D9' },
          { label:'Tareas pendientes', val:stats.pending,                 color:'#A8D170' },
          { label:'Vencidas',          val:stats.byStatus.overdue.length, color:'#ef4444' },
          { label:'Por vencer',        val:stats.byStatus.warning.length, color:'#f59e0b' },
          { label:'Completadas',       val:`${stats.completionRate}%`,    color:'#22c55e' },
        ].map(k => (
          <div key={k.label} style={{ background:'var(--bg-surface)', border:`1.5px solid ${k.color}44`, borderRadius:10, padding:14 }}>
            <div style={{ fontSize:24, fontWeight:800, color:k.color }}>{k.val}</div>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div className="ft-dash-grid" style={{ display:'grid', gridTemplateColumns:'minmax(220px,320px) 1fr', gap:18 }}>
        {/* Donut de distribución por estado */}
        <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:14, padding:18, display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
          <div style={{ fontSize:13, fontWeight:700, alignSelf:'flex-start' }}>Distribución por estado</div>
          {stats.total === 0 ? (
            <div style={{ fontSize:13, color:'var(--text-faint)', padding:'30px 0' }}>Sin tareas para mostrar.</div>
          ) : (
            <>
              <svg width={160} height={160} viewBox="0 0 160 160">
                <g transform="rotate(-90 80 80)">
                  {donutSegments.filter(s => s.count > 0).map(s => (
                    <circle
                      key={s.key}
                      cx={80} cy={80} r={DONUT_R}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={hoverSeg===s.key ? 24 : 20}
                      strokeDasharray={`${s.frac*DONUT_C} ${DONUT_C - s.frac*DONUT_C}`}
                      strokeDashoffset={-s.offset*DONUT_C}
                      onMouseEnter={() => setHoverSeg(s.key)}
                      onMouseLeave={() => setHoverSeg(null)}
                      onClick={() => onDrillTasks(s.key)}
                      style={{ cursor:'pointer', transition:'stroke-width .15s' }}
                    >
                      <title>{`${s.label}: ${s.count}`}</title>
                    </circle>
                  ))}
                </g>
                <text x={80} y={76} textAnchor="middle" fontSize={22} fontWeight={800} fill="var(--text-primary)">{stats.total}</text>
                <text x={80} y={94} textAnchor="middle" fontSize={10} fill="var(--text-muted)">tareas</text>
              </svg>
              <div style={{ display:'flex', flexDirection:'column', gap:6, width:'100%' }}>
                {donutSegments.map(s => (
                  <div key={s.key} onMouseEnter={() => setHoverSeg(s.key)} onMouseLeave={() => setHoverSeg(null)} onClick={() => onDrillTasks(s.key)}
                    style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, cursor:'pointer', padding:'3px 6px', borderRadius:6, background: hoverSeg===s.key ? 'var(--bg-hover)' : 'transparent' }}>
                    <span style={{ width:9, height:9, borderRadius:'50%', background:s.color, flexShrink:0 }} />
                    <span style={{ flex:1, color:'var(--text-secondary)' }}>{s.label}</span>
                    <span style={{ fontWeight:700, color:'var(--text-primary)' }}>{s.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Barras por proyecto */}
        <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:14, padding:18 }}>
          <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>Tareas pendientes por proyecto</div>
          {perProject.length === 0 && <div style={{ fontSize:13, color:'var(--text-faint)' }}>Sin proyectos para mostrar.</div>}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {perProject.map(p => (
              <div key={p.id}>
                <div onClick={() => onDrillProject(p.id)} style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4, cursor:'pointer' }}>
                  <span style={{ color:'var(--text-secondary)', fontWeight:600 }}>📁 {p.name}</span>
                  <span style={{ color:'var(--text-muted)' }}>{p.pendingCount} pendiente{p.pendingCount!==1?'s':''} · {p.total} total</span>
                </div>
                <div style={{ display:'flex', height:14, borderRadius:7, overflow:'hidden', background:'var(--bg-elevated)' }}>
                  {SEGMENT_KEYS.map(key => {
                    const c = p.counts[key]
                    if (!c) return null
                    const w = Math.max(2, (c / maxPending) * 100)
                    const segKey = `${p.id}-${key}`
                    return (
                      <div key={key}
                        onMouseEnter={() => setHoverBar(segKey)}
                        onMouseLeave={() => setHoverBar(null)}
                        title={`${STATUS[key].label}: ${c}`}
                        style={{ width:`${w}%`, background:STATUS[key].badge, opacity: hoverBar && hoverBar!==segKey ? 0.5 : 1, transition:'opacity .15s' }}
                      />
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Listas rápidas */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:18 }}>
        <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
          <div style={{ padding:'10px 16px', borderBottom:'1px solid var(--border)', background:'var(--bg-elevated)', fontWeight:700, fontSize:13, color:'#ef4444' }}>⚠️ Vencidas</div>
          {overdueList.length === 0 && <div style={{ padding:16, fontSize:13, color:'var(--text-faint)' }}>No hay tareas vencidas 🎉</div>}
          {overdueList.map(t => (
            <div key={t.id} onClick={() => onDrillProject(t.projectId, t.id)} style={{ padding:'9px 16px', borderBottom:'1px solid var(--border)', cursor:'pointer', display:'flex', justifyContent:'space-between', gap:8 }}>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:13, color:'var(--text-primary)', fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{t.title}</div>
                <div style={{ fontSize:11, color:t.projectColor }}>📁 {t.projectName}</div>
              </div>
              <div style={{ fontSize:11, color:'#ef4444', flexShrink:0, alignSelf:'center' }}>{fmtSimpleDate(t.due_date)}</div>
            </div>
          ))}
        </div>

        <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
          <div style={{ padding:'10px 16px', borderBottom:'1px solid var(--border)', background:'var(--bg-elevated)', fontWeight:700, fontSize:13, color:'#f59e0b' }}>🕒 Próximas a vencer</div>
          {upcoming.length === 0 && <div style={{ padding:16, fontSize:13, color:'var(--text-faint)' }}>No hay vencimientos próximos.</div>}
          {upcoming.map(t => (
            <div key={t.id} onClick={() => onDrillProject(t.projectId, t.id)} style={{ padding:'9px 16px', borderBottom:'1px solid var(--border)', cursor:'pointer', display:'flex', justifyContent:'space-between', gap:8 }}>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:13, color:'var(--text-primary)', fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{t.title}</div>
                <div style={{ fontSize:11, color:t.projectColor }}>📁 {t.projectName}</div>
              </div>
              <div style={{ fontSize:11, color:'#f59e0b', flexShrink:0, alignSelf:'center' }}>{t.due_date ? fmtSimpleDate(t.due_date) : '—'}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
