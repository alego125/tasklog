require('dotenv').config()
const express = require('express')
const cors    = require('cors')
const path    = require('path')
const fs      = require('fs')

const app  = express()
const PORT = process.env.PORT || 3001

// ── Crear carpeta data si no existe ──────────────────────────────
const dataDir = path.join(__dirname, '..', 'data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
  console.log('📁 Carpeta data/ creada automáticamente')
}

// ── Fix Windows: backslashes → forward slashes ───────────────────
const dbPath = path.join(dataDir, 'tasklog.db').replace(/\\/g, '/')

// ── Cliente DB: Turso en producción, SQLite local en desarrollo ──
let db
async function getDb() {
  if (db) return db

  if (process.env.TURSO_DATABASE_URL) {
    // PRODUCCIÓN: Turso cloud vía HTTP (sin binarios nativos)
    const { createClient } = require('@libsql/client/http')
    db = createClient({
      url: process.env.TURSO_DATABASE_URL.replace('libsql://', 'https://'),
      authToken: process.env.TURSO_AUTH_TOKEN
    })
    console.log('🌐 Conectado a Turso cloud')
  } else {
    // DESARROLLO LOCAL: SQLite archivo local
    const { createClient } = require('@libsql/client')
    db = createClient({ url: `file:${dbPath}` })
    console.log(`🗄️  BD local: ${dbPath}`)
  }
  return db
}

// ── Schema ───────────────────────────────────────────────────────
async function initDB() {
  const db = await getDb()

  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS projects (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      color      TEXT    NOT NULL DEFAULT '#6366f1',
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id   INTEGER NOT NULL,
      title        TEXT    NOT NULL,
      responsible  TEXT,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      due_date     TEXT    NOT NULL,
      done         INTEGER NOT NULL DEFAULT 0,
      done_at      TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS task_comments (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id    INTEGER NOT NULL,
      author     TEXT,
      text       TEXT    NOT NULL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_due     ON tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_tasks_done    ON tasks(done);
    CREATE INDEX IF NOT EXISTS idx_comments_task ON task_comments(task_id);
  `)

  // Seed si está vacío
  const count = await db.execute('SELECT COUNT(*) as n FROM projects')
  if (Number(count.rows[0].n) === 0) {
    const p1 = await db.execute({ sql: 'INSERT INTO projects (name,color) VALUES (?,?)', args: ['Rediseño Web','#6366f1'] })
    const p2 = await db.execute({ sql: 'INSERT INTO projects (name,color) VALUES (?,?)', args: ['App Móvil v2','#f59e0b'] })
    const t1 = await db.execute({ sql: 'INSERT INTO tasks (project_id,title,responsible,due_date,created_at) VALUES (?,?,?,?,?)', args: [p1.lastInsertRowid,'Diseñar wireframes homepage','Ana García','2026-02-28','2026-02-01'] })
    const t3 = await db.execute({ sql: 'INSERT INTO tasks (project_id,title,responsible,due_date,created_at) VALUES (?,?,?,?,?)', args: [p2.lastInsertRowid,'Integrar API de pagos','Martina Ruiz','2026-03-10','2026-02-10'] })
    await db.execute({ sql: 'INSERT INTO tasks (project_id,title,responsible,due_date,created_at) VALUES (?,?,?,?,?)', args: [p1.lastInsertRowid,'Revisar paleta de colores','Carlos López','2026-03-15','2026-02-03'] })
    await db.execute({ sql: 'INSERT INTO task_comments (task_id,author,text) VALUES (?,?,?)', args: [t1.lastInsertRowid,'Ana García','Empezando con los bocetos iniciales.'] })
    await db.execute({ sql: 'INSERT INTO task_comments (task_id,author,text) VALUES (?,?,?)', args: [t3.lastInsertRowid,'Martina Ruiz','Revisé la doc de Stripe, lista para integrar.'] })
    await db.execute({ sql: 'INSERT INTO tasks (project_id,title,responsible,due_date,created_at,done,done_at) VALUES (?,?,?,?,?,1,?)', args: [p2.lastInsertRowid,'Testing de regresión','Juan Pérez','2026-02-10','2026-01-20','2026-02-09'] })
    console.log('✅ Datos de ejemplo insertados')
  }
}

// ── Helper: proyecto completo ─────────────────────────────────────
async function getFullProject(id) {
  const db = await getDb()
  const pRes = await db.execute({ sql: 'SELECT * FROM projects WHERE id = ?', args: [id] })
  if (!pRes.rows.length) return null
  const project = { ...pRes.rows[0] }
  const tRes = await db.execute({ sql: 'SELECT * FROM tasks WHERE project_id = ? ORDER BY id', args: [id] })
  const tasks = []
  for (const row of tRes.rows) {
    const task = { ...row, done: Boolean(row.done) }
    const cRes = await db.execute({ sql: 'SELECT * FROM task_comments WHERE task_id = ? ORDER BY id', args: [task.id] })
    task.comments = cRes.rows.map(r => ({ ...r }))
    tasks.push(task)
  }
  project.tasks = tasks
  return project
}

// ── Middlewares ───────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }))
app.use(express.json())

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'dist')))
}

// ── PROJECTS ──────────────────────────────────────────────────────
app.get('/api/projects', async (req, res) => {
  try {
    const db = await getDb()
    const result = await db.execute('SELECT * FROM projects ORDER BY id')
    const projects = await Promise.all(result.rows.map(p => getFullProject(p.id)))
    res.json(projects)
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/projects', async (req, res) => {
  try {
    const db = await getDb()
    const { name, color = '#6366f1' } = req.body
    if (!name) return res.status(400).json({ error: 'name requerido' })
    const r = await db.execute({ sql: 'INSERT INTO projects (name,color) VALUES (?,?)', args: [name, color] })
    res.json(await getFullProject(r.lastInsertRowid))
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/projects/:id', async (req, res) => {
  try {
    const db = await getDb()
    await db.execute({ sql: 'DELETE FROM projects WHERE id = ?', args: [req.params.id] })
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── TASKS ─────────────────────────────────────────────────────────
app.post('/api/tasks', async (req, res) => {
  try {
    const db = await getDb()
    const { project_id, title, responsible, due_date } = req.body
    if (!project_id || !title || !due_date) return res.status(400).json({ error: 'Faltan campos' })
    const today = new Date().toISOString().split('T')[0]
    const r = await db.execute({ sql: 'INSERT INTO tasks (project_id,title,responsible,due_date,created_at) VALUES (?,?,?,?,?)', args: [project_id, title, responsible||'', due_date, today] })
    const tRes = await db.execute({ sql: 'SELECT * FROM tasks WHERE id = ?', args: [r.lastInsertRowid] })
    res.json({ ...tRes.rows[0], done: false, comments: [] })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.put('/api/tasks/:id', async (req, res) => {
  try {
    const db = await getDb()
    const { title, responsible, due_date } = req.body
    await db.execute({ sql: 'UPDATE tasks SET title=?,responsible=?,due_date=? WHERE id=?', args: [title, responsible, due_date, req.params.id] })
    const tRes = await db.execute({ sql: 'SELECT * FROM tasks WHERE id = ?', args: [req.params.id] })
    const task = { ...tRes.rows[0], done: Boolean(tRes.rows[0].done) }
    const cRes = await db.execute({ sql: 'SELECT * FROM task_comments WHERE task_id=? ORDER BY id', args: [task.id] })
    task.comments = cRes.rows.map(r => ({ ...r }))
    res.json(task)
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.patch('/api/tasks/:id/toggle', async (req, res) => {
  try {
    const db = await getDb()
    const tRes = await db.execute({ sql: 'SELECT * FROM tasks WHERE id=?', args: [req.params.id] })
    if (!tRes.rows.length) return res.status(404).json({ error: 'No encontrada' })
    const task    = tRes.rows[0]
    const newDone = task.done ? 0 : 1
    const doneAt  = newDone ? new Date().toISOString().split('T')[0] : null
    await db.execute({ sql: 'UPDATE tasks SET done=?,done_at=? WHERE id=?', args: [newDone, doneAt, task.id] })
    const updated = (await db.execute({ sql: 'SELECT * FROM tasks WHERE id=?', args: [task.id] })).rows[0]
    updated.done = Boolean(updated.done)
    const cRes = await db.execute({ sql: 'SELECT * FROM task_comments WHERE task_id=? ORDER BY id', args: [task.id] })
    updated.comments = cRes.rows.map(r => ({ ...r }))
    res.json(updated)
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const db = await getDb()
    await db.execute({ sql: 'DELETE FROM tasks WHERE id=?', args: [req.params.id] })
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── COMMENTS ──────────────────────────────────────────────────────
app.post('/api/comments', async (req, res) => {
  try {
    const db = await getDb()
    const { task_id, author = 'Yo', text } = req.body
    if (!task_id || !text) return res.status(400).json({ error: 'Faltan campos' })
    const r = await db.execute({ sql: 'INSERT INTO task_comments (task_id,author,text) VALUES (?,?,?)', args: [task_id, author, text] })
    const comment = (await db.execute({ sql: 'SELECT * FROM task_comments WHERE id=?', args: [r.lastInsertRowid] })).rows[0]
    res.json({ ...comment })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.put('/api/comments/:id', async (req, res) => {
  try {
    const db = await getDb()
    await db.execute({ sql: 'UPDATE task_comments SET text=? WHERE id=?', args: [req.body.text, req.params.id] })
    const comment = (await db.execute({ sql: 'SELECT * FROM task_comments WHERE id=?', args: [req.params.id] })).rows[0]
    res.json({ ...comment })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/comments/:id', async (req, res) => {
  try {
    const db = await getDb()
    await db.execute({ sql: 'DELETE FROM task_comments WHERE id=?', args: [req.params.id] })
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// Catch-all para React en producción
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'))
  })
}

// ── Arrancar ──────────────────────────────────────────────────────
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ TaskLog API corriendo en http://localhost:${PORT}`)
  })
}).catch(err => {
  console.error('❌ Error iniciando BD:', err.message)
  process.exit(1)
})
