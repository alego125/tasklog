require('dotenv').config()
const express = require('express')
const cors    = require('cors')
const path    = require('path')
const fs      = require('fs')

const app  = express()
const PORT = process.env.PORT || 3001

const dataDir = path.join(__dirname, '..', 'data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
  console.log('📁 Carpeta data/ creada automáticamente')
}

const dbPath = path.join(dataDir, 'tasklog.db').replace(/\\/g, '/')

let db
async function getDb() {
  if (db) return db
  if (process.env.TURSO_DATABASE_URL) {
    const { createClient } = require('@libsql/client/http')
    db = createClient({
      url: process.env.TURSO_DATABASE_URL.replace('libsql://', 'https://'),
      authToken: process.env.TURSO_AUTH_TOKEN
    })
    console.log('🌐 Conectado a Turso cloud')
  } else {
    const { createClient } = require('@libsql/client')
    db = createClient({ url: `file:${dbPath}` })
    console.log(`🗄️  BD local: ${dbPath}`)
  }
  return db
}

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
      due_date     TEXT,
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
    CREATE TABLE IF NOT EXISTS project_notes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      text       TEXT    NOT NULL,
      author     TEXT,
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_project  ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_due      ON tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_tasks_done     ON tasks(done);
    CREATE INDEX IF NOT EXISTS idx_comments_task  ON task_comments(task_id);
    CREATE INDEX IF NOT EXISTS idx_notes_project  ON project_notes(project_id);
  `)

  console.log('✅ Schema verificado — BD lista')
}

async function getFullProject(id) {
  const db = await getDb()
  const pRes = await db.execute({ sql: 'SELECT * FROM projects WHERE id = ?', args: [id] })
  if (!pRes.rows.length) return null
  const project = { ...pRes.rows[0] }
  const tRes = await db.execute({ sql: 'SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at ASC', args: [id] })
  const tasks = []
  for (const row of tRes.rows) {
    const task = { ...row, done: Boolean(row.done) }
    const cRes = await db.execute({ sql: 'SELECT * FROM task_comments WHERE task_id = ? ORDER BY id', args: [task.id] })
    task.comments = cRes.rows.map(r => ({ ...r }))
    tasks.push(task)
  }
  project.tasks = tasks
  const nRes = await db.execute({ sql: 'SELECT * FROM project_notes WHERE project_id = ? ORDER BY created_at ASC', args: [id] })
  project.notes = nRes.rows.map(r => ({ ...r }))
  return project
}

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }))
app.use(express.json())

// PROJECTS
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

app.put('/api/projects/:id', async (req, res) => {
  try {
    const db = await getDb()
    const { name, color } = req.body
    if (!name) return res.status(400).json({ error: 'name requerido' })
    await db.execute({ sql: 'UPDATE projects SET name=?, color=? WHERE id=?', args: [name, color, req.params.id] })
    res.json(await getFullProject(req.params.id))
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/projects/:id', async (req, res) => {
  try {
    const db = await getDb()
    await db.execute({ sql: 'DELETE FROM projects WHERE id = ?', args: [req.params.id] })
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// TASKS
app.post('/api/tasks', async (req, res) => {
  try {
    const db = await getDb()
    const { project_id, title, responsible, due_date } = req.body
    if (!project_id || !title) return res.status(400).json({ error: 'Faltan campos' })
    const today = new Date().toISOString().split('T')[0]
    const r = await db.execute({
      sql: 'INSERT INTO tasks (project_id,title,responsible,due_date,created_at) VALUES (?,?,?,?,?)',
      args: [project_id, title, responsible||'', (due_date && due_date.trim()) ? due_date : null, today]
    })
    const tRes = await db.execute({ sql: 'SELECT * FROM tasks WHERE id = ?', args: [r.lastInsertRowid] })
    res.json({ ...tRes.rows[0], done: false, comments: [] })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.put('/api/tasks/:id', async (req, res) => {
  try {
    const db = await getDb()
    const { title, responsible, due_date } = req.body
    await db.execute({ sql: 'UPDATE tasks SET title=?,responsible=?,due_date=? WHERE id=?', args: [title, responsible, due_date||null, req.params.id] })
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

// TASK COMMENTS
app.post('/api/comments', async (req, res) => {
  try {
    const db = await getDb()
    const { task_id, author = 'Yo', text } = req.body
    if (!task_id || !text) return res.status(400).json({ error: 'Faltan campos' })
    const r = await db.execute({ sql: 'INSERT INTO task_comments (task_id,author,text) VALUES (?,?,?)', args: [task_id, author, text] })
    res.json({ ...(await db.execute({ sql: 'SELECT * FROM task_comments WHERE id=?', args: [r.lastInsertRowid] })).rows[0] })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.put('/api/comments/:id', async (req, res) => {
  try {
    const db = await getDb()
    await db.execute({ sql: 'UPDATE task_comments SET text=? WHERE id=?', args: [req.body.text, req.params.id] })
    res.json({ ...(await db.execute({ sql: 'SELECT * FROM task_comments WHERE id=?', args: [req.params.id] })).rows[0] })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/comments/:id', async (req, res) => {
  try {
    const db = await getDb()
    await db.execute({ sql: 'DELETE FROM task_comments WHERE id=?', args: [req.params.id] })
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// PROJECT NOTES
app.post('/api/project-notes', async (req, res) => {
  try {
    const db = await getDb()
    const { project_id, author = 'Yo', text } = req.body
    if (!project_id || !text) return res.status(400).json({ error: 'Faltan campos' })
    const r = await db.execute({ sql: 'INSERT INTO project_notes (project_id,author,text) VALUES (?,?,?)', args: [project_id, author, text] })
    res.json({ ...(await db.execute({ sql: 'SELECT * FROM project_notes WHERE id=?', args: [r.lastInsertRowid] })).rows[0] })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.put('/api/project-notes/:id', async (req, res) => {
  try {
    const db = await getDb()
    await db.execute({ sql: 'UPDATE project_notes SET text=? WHERE id=?', args: [req.body.text, req.params.id] })
    res.json({ ...(await db.execute({ sql: 'SELECT * FROM project_notes WHERE id=?', args: [req.params.id] })).rows[0] })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/project-notes/:id', async (req, res) => {
  try {
    const db = await getDb()
    await db.execute({ sql: 'DELETE FROM project_notes WHERE id=?', args: [req.params.id] })
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// MOVER nota de proyecto → comentario de tarea
app.post('/api/project-notes/:id/move-to-task', async (req, res) => {
  try {
    const db = await getDb()
    const { task_id } = req.body
    if (!task_id) return res.status(400).json({ error: 'task_id requerido' })
    const note = (await db.execute({ sql: 'SELECT * FROM project_notes WHERE id=?', args: [req.params.id] })).rows[0]
    if (!note) return res.status(404).json({ error: 'Nota no encontrada' })
    const r = await db.execute({ sql: 'INSERT INTO task_comments (task_id,author,text,created_at) VALUES (?,?,?,?)', args: [task_id, note.author, note.text, note.created_at] })
    await db.execute({ sql: 'DELETE FROM project_notes WHERE id=?', args: [req.params.id] })
    const comment = (await db.execute({ sql: 'SELECT * FROM task_comments WHERE id=?', args: [r.lastInsertRowid] })).rows[0]
    res.json({ comment: { ...comment }, deletedNoteId: Number(req.params.id) })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// MOVER comentario de tarea → nota de proyecto
app.post('/api/comments/:id/move-to-project', async (req, res) => {
  try {
    const db = await getDb()
    const { project_id } = req.body
    if (!project_id) return res.status(400).json({ error: 'project_id requerido' })
    const comment = (await db.execute({ sql: 'SELECT * FROM task_comments WHERE id=?', args: [req.params.id] })).rows[0]
    if (!comment) return res.status(404).json({ error: 'Comentario no encontrado' })
    const r = await db.execute({ sql: 'INSERT INTO project_notes (project_id,author,text,created_at) VALUES (?,?,?,?)', args: [project_id, comment.author, comment.text, comment.created_at] })
    await db.execute({ sql: 'DELETE FROM task_comments WHERE id=?', args: [req.params.id] })
    const note = (await db.execute({ sql: 'SELECT * FROM project_notes WHERE id=?', args: [r.lastInsertRowid] })).rows[0]
    res.json({ note: { ...note }, deletedCommentId: Number(req.params.id) })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ TaskLog API corriendo en http://localhost:${PORT}`)
  })
}).catch(err => {
  console.error('❌ Error iniciando BD:', err.message)
  process.exit(1)
})
