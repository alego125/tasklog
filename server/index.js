require('dotenv').config()
const express = require('express')
const cors    = require('cors')
const { Pool } = require('pg')

const app  = express()
const PORT = process.env.PORT || 3001

// ── Conexión PostgreSQL ──────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

const db = {
  query: (text, params) => pool.query(text, params)
}

console.log('🐘 Conectando a PostgreSQL (Neon)...')

// ── Schema ───────────────────────────────────────────────────────
async function initDB() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id         SERIAL PRIMARY KEY,
      name       TEXT    NOT NULL,
      color      TEXT    NOT NULL DEFAULT '#6366f1',
      archived   BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id           SERIAL PRIMARY KEY,
      project_id   INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title        TEXT    NOT NULL,
      responsible  TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      due_date     DATE,
      done         BOOLEAN NOT NULL DEFAULT false,
      done_at      DATE
    )
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS task_comments (
      id         SERIAL PRIMARY KEY,
      task_id    INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      author     TEXT,
      text       TEXT    NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS project_notes (
      id         SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      text       TEXT    NOT NULL,
      author     TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_tasks_project  ON tasks(project_id)`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_tasks_due      ON tasks(due_date)`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_tasks_done     ON tasks(done)`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_comments_task  ON task_comments(task_id)`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_notes_project  ON project_notes(project_id)`)

  console.log('✅ Schema verificado — BD lista')
}

// ── Helper: proyecto completo ────────────────────────────────────
async function getFullProject(id) {
  const pRes = await db.query('SELECT * FROM projects WHERE id = $1', [id])
  if (!pRes.rows.length) return null
  const project = { ...pRes.rows[0] }

  const tRes = await db.query(
    'SELECT * FROM tasks WHERE project_id = $1 ORDER BY created_at ASC', [id]
  )
  const tasks = []
  for (const row of tRes.rows) {
    const task = { ...row }
    const cRes = await db.query(
      'SELECT * FROM task_comments WHERE task_id = $1 ORDER BY id', [task.id]
    )
    task.comments = cRes.rows
    tasks.push(task)
  }
  project.tasks = tasks

  const nRes = await db.query(
    'SELECT * FROM project_notes WHERE project_id = $1 ORDER BY created_at ASC', [id]
  )
  project.notes = nRes.rows
  return project
}

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }))
app.use(express.json())

// ── PROJECTS ─────────────────────────────────────────────────────
app.get('/api/projects', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM projects WHERE archived = false ORDER BY id')
    const projects = await Promise.all(result.rows.map(p => getFullProject(p.id)))
    res.json(projects)
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/projects/archived', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM projects WHERE archived = true ORDER BY id')
    const projects = await Promise.all(result.rows.map(p => getFullProject(p.id)))
    res.json(projects)
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/projects', async (req, res) => {
  try {
    const { name, color = '#6366f1' } = req.body
    if (!name) return res.status(400).json({ error: 'name requerido' })
    const r = await db.query(
      'INSERT INTO projects (name, color) VALUES ($1, $2) RETURNING id', [name, color]
    )
    res.json(await getFullProject(r.rows[0].id))
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.put('/api/projects/:id', async (req, res) => {
  try {
    const { name, color } = req.body
    if (!name) return res.status(400).json({ error: 'name requerido' })
    await db.query('UPDATE projects SET name=$1, color=$2 WHERE id=$3', [name, color, req.params.id])
    res.json(await getFullProject(req.params.id))
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.patch('/api/projects/:id/archive', async (req, res) => {
  try {
    await db.query('UPDATE projects SET archived = true WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.patch('/api/projects/:id/unarchive', async (req, res) => {
  try {
    await db.query('UPDATE projects SET archived = false WHERE id = $1', [req.params.id])
    res.json(await getFullProject(req.params.id))
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/projects/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM projects WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── TASKS ────────────────────────────────────────────────────────
app.post('/api/tasks', async (req, res) => {
  try {
    const { project_id, title, responsible, due_date } = req.body
    if (!project_id || !title) return res.status(400).json({ error: 'Faltan campos' })
    const r = await db.query(
      'INSERT INTO tasks (project_id, title, responsible, due_date) VALUES ($1, $2, $3, $4) RETURNING *',
      [project_id, title, responsible || null, (due_date && due_date.trim()) ? due_date : null]
    )
    res.json({ ...r.rows[0], comments: [] })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { title, responsible, due_date } = req.body
    await db.query(
      'UPDATE tasks SET title=$1, responsible=$2, due_date=$3 WHERE id=$4',
      [title, responsible || null, (due_date && due_date.trim()) ? due_date : null, req.params.id]
    )
    const tRes = await db.query('SELECT * FROM tasks WHERE id = $1', [req.params.id])
    const task = { ...tRes.rows[0] }
    const cRes = await db.query('SELECT * FROM task_comments WHERE task_id=$1 ORDER BY id', [task.id])
    task.comments = cRes.rows
    res.json(task)
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.patch('/api/tasks/:id/toggle', async (req, res) => {
  try {
    const tRes = await db.query('SELECT * FROM tasks WHERE id=$1', [req.params.id])
    if (!tRes.rows.length) return res.status(404).json({ error: 'No encontrada' })
    const task    = tRes.rows[0]
    const newDone = !task.done
    const doneAt  = newDone ? new Date().toISOString().split('T')[0] : null
    await db.query('UPDATE tasks SET done=$1, done_at=$2 WHERE id=$3', [newDone, doneAt, task.id])
    const updated = (await db.query('SELECT * FROM tasks WHERE id=$1', [task.id])).rows[0]
    const cRes = await db.query('SELECT * FROM task_comments WHERE task_id=$1 ORDER BY id', [task.id])
    updated.comments = cRes.rows
    res.json(updated)
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM tasks WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── TASK COMMENTS ────────────────────────────────────────────────
app.post('/api/comments', async (req, res) => {
  try {
    const { task_id, author = 'Yo', text } = req.body
    if (!task_id || !text) return res.status(400).json({ error: 'Faltan campos' })
    const r = await db.query(
      'INSERT INTO task_comments (task_id, author, text) VALUES ($1, $2, $3) RETURNING *',
      [task_id, author, text]
    )
    res.json(r.rows[0])
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.put('/api/comments/:id', async (req, res) => {
  try {
    await db.query('UPDATE task_comments SET text=$1 WHERE id=$2', [req.body.text, req.params.id])
    const r = await db.query('SELECT * FROM task_comments WHERE id=$1', [req.params.id])
    res.json(r.rows[0])
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/comments/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM task_comments WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── PROJECT NOTES ────────────────────────────────────────────────
app.post('/api/project-notes', async (req, res) => {
  try {
    const { project_id, author = 'Yo', text } = req.body
    if (!project_id || !text) return res.status(400).json({ error: 'Faltan campos' })
    const r = await db.query(
      'INSERT INTO project_notes (project_id, author, text) VALUES ($1, $2, $3) RETURNING *',
      [project_id, author, text]
    )
    res.json(r.rows[0])
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.put('/api/project-notes/:id', async (req, res) => {
  try {
    await db.query('UPDATE project_notes SET text=$1 WHERE id=$2', [req.body.text, req.params.id])
    const r = await db.query('SELECT * FROM project_notes WHERE id=$1', [req.params.id])
    res.json(r.rows[0])
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/project-notes/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM project_notes WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── MOVER nota de proyecto → comentario de tarea ─────────────────
app.post('/api/project-notes/:id/move-to-task', async (req, res) => {
  try {
    const { task_id } = req.body
    if (!task_id) return res.status(400).json({ error: 'task_id requerido' })
    const note = (await db.query('SELECT * FROM project_notes WHERE id=$1', [req.params.id])).rows[0]
    if (!note) return res.status(404).json({ error: 'Nota no encontrada' })
    const r = await db.query(
      'INSERT INTO task_comments (task_id, author, text, created_at) VALUES ($1, $2, $3, $4) RETURNING *',
      [task_id, note.author, note.text, note.created_at]
    )
    await db.query('DELETE FROM project_notes WHERE id=$1', [req.params.id])
    res.json({ comment: r.rows[0], deletedNoteId: Number(req.params.id) })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── MOVER comentario de tarea → nota de proyecto ─────────────────
app.post('/api/comments/:id/move-to-project', async (req, res) => {
  try {
    const { project_id } = req.body
    if (!project_id) return res.status(400).json({ error: 'project_id requerido' })
    const comment = (await db.query('SELECT * FROM task_comments WHERE id=$1', [req.params.id])).rows[0]
    if (!comment) return res.status(404).json({ error: 'Comentario no encontrado' })
    const r = await db.query(
      'INSERT INTO project_notes (project_id, author, text, created_at) VALUES ($1, $2, $3, $4) RETURNING *',
      [project_id, comment.author, comment.text, comment.created_at]
    )
    await db.query('DELETE FROM task_comments WHERE id=$1', [req.params.id])
    res.json({ note: r.rows[0], deletedCommentId: Number(req.params.id) })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── Start ────────────────────────────────────────────────────────
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ TaskLog API corriendo en http://localhost:${PORT}`)
  })
}).catch(err => {
  console.error('❌ Error iniciando BD:', err.message)
  process.exit(1)
})
