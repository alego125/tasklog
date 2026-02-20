import { useState } from 'react'

export default function SchemaView() {
  const [tab, setTab] = useState('diagram')
  const tables = [
    { name:'projects', color:'#6366f1', fields:[
      {name:'id',type:'INTEGER',pk:true},{name:'name',type:'TEXT',note:'NOT NULL'},
      {name:'color',type:'TEXT',note:'DEFAULT #6366f1'},{name:'created_at',type:'TEXT',note:'DEFAULT now()'}]},
    { name:'tasks', color:'#f59e0b', fields:[
      {name:'id',type:'INTEGER',pk:true},{name:'project_id',type:'INTEGER',fk:true},
      {name:'title',type:'TEXT',note:'NOT NULL'},{name:'responsible',type:'TEXT'},
      {name:'created_at',type:'TEXT'},{name:'due_date',type:'TEXT',note:'NOT NULL'},
      {name:'done',type:'INTEGER',note:'DEFAULT 0'},{name:'done_at',type:'TEXT'}]},
    { name:'task_comments', color:'#14b8a6', fields:[
      {name:'id',type:'INTEGER',pk:true},{name:'task_id',type:'INTEGER',fk:true},
      {name:'author',type:'TEXT'},{name:'text',type:'TEXT',note:'NOT NULL'},
      {name:'created_at',type:'TEXT'}]},
  ]
  const sql = `-- TaskLog — SQLite Schema

CREATE TABLE projects (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#6366f1',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE tasks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id   INTEGER NOT NULL,
  title        TEXT NOT NULL,
  responsible  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  due_date     TEXT NOT NULL,
  done         INTEGER NOT NULL DEFAULT 0,
  done_at      TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE task_comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id    INTEGER NOT NULL,
  author     TEXT,
  text       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_due     ON tasks(due_date);
CREATE INDEX idx_tasks_done    ON tasks(done);
CREATE INDEX idx_comments_task ON task_comments(task_id);`

  return (
    <div style={{ maxWidth:1100, margin:'0 auto', padding:'28px 20px' }}>
      <div style={{ fontSize:22, fontWeight:800, marginBottom:4 }}>🗄️ Esquema SQLite</div>
      <div style={{ fontSize:14, color:'#64748b', marginBottom:18 }}>Base de datos real en archivo local — tasklog.db</div>
      <div style={{ display:'flex', gap:8, marginBottom:18 }}>
        {['diagram','sql'].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{ background:tab===t?'#6366f1':'#1e293b', border:'1px solid #334155', color:'#e2e8f0', padding:'8px 18px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 }}>
            {t==='diagram'?'📊 Diagrama ER':'💾 SQL DDL'}
          </button>
        ))}
      </div>
      {tab==='diagram' && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))', gap:16, marginBottom:16 }}>
            {tables.map(table=>(
              <div key={table.name} style={{ background:'#0f172a', border:`2px solid ${table.color}`, borderRadius:12, overflow:'hidden' }}>
                <div style={{ background:`${table.color}22`, borderBottom:`1px solid ${table.color}`, padding:'11px 15px', fontWeight:800, fontSize:14, color:table.color }}>📄 {table.name}</div>
                {table.fields.map(f=>(
                  <div key={f.name} style={{ padding:'8px 13px', borderBottom:'1px solid #1e293b', display:'flex', justifyContent:'space-between', alignItems:'center', background:f.pk?'#fbbf2408':f.fk?'#60a5fa08':'transparent' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      {f.pk && <span style={{ fontSize:10, background:'#92400e', color:'#fbbf24', padding:'1px 5px', borderRadius:4, fontWeight:700 }}>PK</span>}
                      {f.fk && <span style={{ fontSize:10, background:'#1e3a5f', color:'#60a5fa', padding:'1px 5px', borderRadius:4, fontWeight:700 }}>FK</span>}
                      <span style={{ fontWeight:600, fontSize:13 }}>{f.name}</span>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:11, color:'#6366f1', fontFamily:'monospace' }}>{f.type}</div>
                      {f.note && <div style={{ fontSize:10, color:'#475569' }}>{f.note}</div>}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ background:'#0f172a', border:'1px solid #1e293b', borderRadius:12, padding:20, textAlign:'center' }}>
            {[{name:'projects',color:'#6366f1'},{arrow:'1 ──── N'},{name:'tasks',color:'#f59e0b'},{arrow:'1 ──── N'},{name:'task_comments',color:'#14b8a6'}].map((el,i)=>
              <span key={i} style={{ marginRight:8 }}>
                {el.name ? <span style={{ background:`${el.color}22`, border:`2px solid ${el.color}`, color:el.color, fontWeight:700, padding:'7px 14px', borderRadius:8, fontSize:13, display:'inline-block' }}>{el.name}</span>
                : <span style={{ color:'#475569', fontFamily:'monospace', fontWeight:700 }}>{el.arrow}</span>}
              </span>
            )}
          </div>
        </>
      )}
      {tab==='sql' && (
        <div style={{ background:'#030712', border:'1px solid #1e293b', borderRadius:12, padding:22, overflow:'auto' }}>
          <pre style={{ fontFamily:'monospace', fontSize:13, color:'#a5f3fc', lineHeight:1.7, margin:0, whiteSpace:'pre-wrap' }}>{sql}</pre>
        </div>
      )}
    </div>
  )
}
