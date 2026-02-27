require('dotenv').config()
const express    = require('express')
const cors       = require('cors')
const bcrypt     = require('bcryptjs')
const jwt        = require('jsonwebtoken')
const { Pool }   = require('pg')

const app    = express()
const PORT   = process.env.PORT || 3001
const SECRET = process.env.JWT_SECRET || 'flowtracker_dev_secret'

// ── Conexión PostgreSQL ──────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})
const db = { query: (text, params) => pool.query(text, params) }
console.log('🐘 Conectando a PostgreSQL (Neon)...')

// ── Schema ───────────────────────────────────────────────────────
async function initDB() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      username   TEXT UNIQUE,
      email      TEXT NOT NULL UNIQUE,
      password   TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id         SERIAL PRIMARY KEY,
      name       TEXT    NOT NULL,
      color      TEXT    NOT NULL DEFAULT '#6366f1',
      archived   BOOLEAN NOT NULL DEFAULT false,
      owner_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS project_members (
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
      role       TEXT NOT NULL DEFAULT 'member',
      joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (project_id, user_id)
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
  await db.query(`CREATE INDEX IF NOT EXISTS idx_tasks_project   ON tasks(project_id)`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_tasks_due       ON tasks(due_date)`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_tasks_done      ON tasks(done)`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_comments_task   ON task_comments(task_id)`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_notes_project   ON project_notes(project_id)`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_members_project ON project_members(project_id)`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_members_user    ON project_members(user_id)`)

  // Migraciones
  try { await db.query(`ALTER TABLE projects ADD COLUMN owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL`) } catch(e) {}
  try { await db.query(`ALTER TABLE users ADD COLUMN username TEXT`) } catch(e) {}
  try { await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)`) } catch(e) {}

  console.log('✅ Schema verificado — BD lista')
}

// ── Auth middleware ───────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const header = req.headers['authorization']
  if (!header) return res.status(401).json({ error: 'Token requerido' })
  const token = header.replace('Bearer ', '')
  try {
    req.user = jwt.verify(token, SECRET)
    next()
  } catch(e) {
    res.status(401).json({ error: 'Token inválido o expirado' })
  }
}

// ── Helpers de autorización ─────────────────────────────────────
async function isMember(projectId, userId) {
  const r = await db.query(
    'SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2',
    [projectId, userId]
  )
  return r.rows.length > 0
}

async function getTaskProject(taskId) {
  const r = await db.query('SELECT project_id FROM tasks WHERE id=$1', [taskId])
  return r.rows.length ? r.rows[0].project_id : null
}

async function getCommentProject(commentId) {
  const r = await db.query(
    'SELECT t.project_id FROM task_comments c JOIN tasks t ON t.id=c.task_id WHERE c.id=$1',
    [commentId]
  )
  return r.rows.length ? r.rows[0].project_id : null
}

async function getNoteProject(noteId) {
  const r = await db.query('SELECT project_id FROM project_notes WHERE id=$1', [noteId])
  return r.rows.length ? r.rows[0].project_id : null
}

function forbidden(res) {
  return res.status(403).json({ error: 'No tenés permiso para realizar esta acción' })
}

// ── Helper: proyecto completo ────────────────────────────────────
async function getFullProject(id) {
  const pRes = await db.query(`
    SELECT p.*, u.name as owner_name FROM projects p
    LEFT JOIN users u ON u.id = p.owner_id
    WHERE p.id = $1
  `, [id])
  if (!pRes.rows.length) return null
  const project = { ...pRes.rows[0] }

  // Miembros
  const mRes = await db.query(`
    SELECT u.id, u.name, u.email, pm.role FROM project_members pm
    JOIN users u ON u.id = pm.user_id WHERE pm.project_id = $1
  `, [id])
  project.members = mRes.rows

  // Tareas
  const tRes = await db.query('SELECT * FROM tasks WHERE project_id = $1 ORDER BY created_at ASC', [id])
  const tasks = []
  for (const row of tRes.rows) {
    const cRes = await db.query('SELECT * FROM task_comments WHERE task_id = $1 ORDER BY id', [row.id])
    tasks.push({ ...row, comments: cRes.rows })
  }
  project.tasks = tasks

  // Notas
  const nRes = await db.query('SELECT * FROM project_notes WHERE project_id = $1 ORDER BY created_at ASC', [id])
  project.notes = nRes.rows
  return project
}

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }))
app.use(express.json())

// ── AUTH ─────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, username, email, password } = req.body
    if (!name || !username || !email || !password) return res.status(400).json({ error: 'Todos los campos son requeridos' })
    if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' })
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return res.status(400).json({ error: 'El usuario solo puede tener letras, números y guión bajo' })
    const existingEmail = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()])
    if (existingEmail.rows.length) return res.status(400).json({ error: 'Ya existe una cuenta con ese email' })
    const existingUser = await db.query('SELECT id FROM users WHERE username = $1', [username.toLowerCase()])
    if (existingUser.rows.length) return res.status(400).json({ error: 'Ese nombre de usuario ya está en uso' })
    const hash = await bcrypt.hash(password, 10)
    const r = await db.query(
      'INSERT INTO users (name, username, email, password) VALUES ($1, $2, $3, $4) RETURNING id, name, username, email',
      [name, username.toLowerCase(), email.toLowerCase(), hash]
    )
    const user = r.rows[0]
    const token = jwt.sign({ id: user.id, name: user.name, username: user.username, email: user.email }, SECRET, { expiresIn: '90m' })
    res.json({ token, user: { id: user.id, name: user.name, username: user.username, email: user.email } })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos' })
    const r = await db.query('SELECT * FROM users WHERE username = $1 OR email = $1', [username.toLowerCase()])
    if (!r.rows.length) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' })
    const user = r.rows[0]
    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' })
    const token = jwt.sign({ id: user.id, name: user.name, username: user.username, email: user.email }, SECRET, { expiresIn: '90m' })
    res.json({ token, user: { id: user.id, name: user.name, username: user.username, email: user.email } })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.put('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const { name, username, email, password } = req.body
    if (!name || !username || !email) return res.status(400).json({ error: 'Nombre, usuario y email son requeridos' })
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return res.status(400).json({ error: 'El usuario solo puede tener letras, números y guión bajo' })
    // Verificar que username y email no estén en uso por otro usuario
    const dupUser = await db.query('SELECT id FROM users WHERE username = $1 AND id != $2', [username.toLowerCase(), req.user.id])
    if (dupUser.rows.length) return res.status(400).json({ error: 'Ese nombre de usuario ya está en uso' })
    const dupEmail = await db.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email.toLowerCase(), req.user.id])
    if (dupEmail.rows.length) return res.status(400).json({ error: 'Ese email ya está en uso' })
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' })
      const hash = await bcrypt.hash(password, 10)
      await db.query('UPDATE users SET name=$1, username=$2, email=$3, password=$4 WHERE id=$5', [name, username.toLowerCase(), email.toLowerCase(), hash, req.user.id])
    } else {
      await db.query('UPDATE users SET name=$1, username=$2, email=$3 WHERE id=$4', [name, username.toLowerCase(), email.toLowerCase(), req.user.id])
    }
    const r = await db.query('SELECT id, name, username, email FROM users WHERE id=$1', [req.user.id])
    const user = r.rows[0]
    const token = jwt.sign({ id: user.id, name: user.name, username: user.username, email: user.email }, SECRET, { expiresIn: '90m' })
    res.json({ token, user })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const r = await db.query('SELECT id, name, email, created_at FROM users WHERE id = $1', [req.user.id])
    if (!r.rows.length) return res.status(404).json({ error: 'Usuario no encontrado' })
    res.json(r.rows[0])
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── PROJECTS ─────────────────────────────────────────────────────
app.get('/api/projects', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT DISTINCT p.* FROM projects p
      JOIN project_members pm ON pm.project_id = p.id
      WHERE pm.user_id = $1 AND p.archived = false ORDER BY p.id
    `, [req.user.id])
    const projects = await Promise.all(result.rows.map(p => getFullProject(p.id)))
    res.json(projects)
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/projects/archived', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT DISTINCT p.* FROM projects p
      JOIN project_members pm ON pm.project_id = p.id
      WHERE pm.user_id = $1 AND p.archived = true ORDER BY p.id
    `, [req.user.id])
    const projects = await Promise.all(result.rows.map(p => getFullProject(p.id)))
    res.json(projects)
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/projects', authMiddleware, async (req, res) => {
  try {
    const { name, color = '#6366f1' } = req.body
    if (!name) return res.status(400).json({ error: 'name requerido' })
    const r = await db.query(
      'INSERT INTO projects (name, color, owner_id) VALUES ($1, $2, $3) RETURNING id',
      [name, color, req.user.id]
    )
    const projectId = r.rows[0].id
    // El creador queda como miembro con rol owner
    await db.query('INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)', [projectId, req.user.id, 'owner'])
    res.json(await getFullProject(projectId))
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.put('/api/projects/:id', authMiddleware, async (req, res) => {
  try {
    if (!await isMember(req.params.id, req.user.id)) return forbidden(res)
    const { name, color } = req.body
    if (!name) return res.status(400).json({ error: 'name requerido' })
    await db.query('UPDATE projects SET name=$1, color=$2 WHERE id=$3', [name, color, req.params.id])
    res.json(await getFullProject(req.params.id))
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.patch('/api/projects/:id/archive', authMiddleware, async (req, res) => {
  try {
    if (!await isMember(req.params.id, req.user.id)) return forbidden(res)
    await db.query('UPDATE projects SET archived = true WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.patch('/api/projects/:id/unarchive', authMiddleware, async (req, res) => {
  try {
    if (!await isMember(req.params.id, req.user.id)) return forbidden(res)
    await db.query('UPDATE projects SET archived = false WHERE id = $1', [req.params.id])
    res.json(await getFullProject(req.params.id))
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/projects/:id', authMiddleware, async (req, res) => {
  try {
    const r = await db.query('SELECT owner_id FROM projects WHERE id=$1', [req.params.id])
    if (!r.rows.length) return res.status(404).json({ error: 'Proyecto no encontrado' })
    if (r.rows[0].owner_id !== req.user.id) return forbidden(res)
    await db.query('DELETE FROM projects WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── MEMBERS ──────────────────────────────────────────────────────
app.get('/api/users/search', authMiddleware, async (req, res) => {
  try {
    const { q } = req.query
    if (!q || q.length < 2) return res.json([])
    const r = await db.query(
      `SELECT id, name, email FROM users WHERE (LOWER(email) LIKE $1 OR LOWER(name) LIKE $1) AND id != $2 LIMIT 10`,
      [`%${q.toLowerCase()}%`, req.user.id]
    )
    res.json(r.rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/projects/:id/members', authMiddleware, async (req, res) => {
  try {
    const r = await db.query('SELECT owner_id FROM projects WHERE id=$1', [req.params.id])
    if (!r.rows.length) return res.status(404).json({ error: 'Proyecto no encontrado' })
    if (r.rows[0].owner_id !== req.user.id) return forbidden(res)
    const { user_id } = req.body
    if (!user_id) return res.status(400).json({ error: 'user_id requerido' })
    await db.query(
      'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [req.params.id, user_id, 'member']
    )
    res.json(await getFullProject(req.params.id))
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/projects/:id/members/:userId', authMiddleware, async (req, res) => {
  try {
    const r = await db.query('SELECT owner_id FROM projects WHERE id=$1', [req.params.id])
    if (!r.rows.length) return res.status(404).json({ error: 'Proyecto no encontrado' })
    if (r.rows[0].owner_id !== req.user.id) return forbidden(res)
    await db.query('DELETE FROM project_members WHERE project_id=$1 AND user_id=$2', [req.params.id, req.params.userId])
    res.json(await getFullProject(req.params.id))
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── TASKS ────────────────────────────────────────────────────────
app.post('/api/tasks', authMiddleware, async (req, res) => {
  try {
    const { project_id, title, responsible, due_date } = req.body
    if (!project_id || !title) return res.status(400).json({ error: 'Faltan campos' })
    if (!await isMember(project_id, req.user.id)) return forbidden(res)
    const r = await db.query(
      'INSERT INTO tasks (project_id, title, responsible, due_date) VALUES ($1, $2, $3, $4) RETURNING *',
      [project_id, title, responsible || null, (due_date && due_date.trim()) ? due_date : null]
    )
    res.json({ ...r.rows[0], comments: [] })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.put('/api/tasks/:id', authMiddleware, async (req, res) => {
  try {
    const projectId = await getTaskProject(req.params.id)
    if (!projectId || !await isMember(projectId, req.user.id)) return forbidden(res)
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

app.patch('/api/tasks/:id/toggle', authMiddleware, async (req, res) => {
  try {
    const tRes = await db.query('SELECT * FROM tasks WHERE id=$1', [req.params.id])
    if (!tRes.rows.length) return res.status(404).json({ error: 'No encontrada' })
    const task    = tRes.rows[0]
    if (!await isMember(task.project_id, req.user.id)) return forbidden(res)
    const newDone = !task.done
    const doneAt  = newDone ? new Date().toISOString().split('T')[0] : null
    await db.query('UPDATE tasks SET done=$1, done_at=$2 WHERE id=$3', [newDone, doneAt, task.id])
    const updated = (await db.query('SELECT * FROM tasks WHERE id=$1', [task.id])).rows[0]
    const cRes = await db.query('SELECT * FROM task_comments WHERE task_id=$1 ORDER BY id', [task.id])
    updated.comments = cRes.rows
    res.json(updated)
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/tasks/:id', authMiddleware, async (req, res) => {
  try {
    const projectId = await getTaskProject(req.params.id)
    if (!projectId || !await isMember(projectId, req.user.id)) return forbidden(res)
    await db.query('DELETE FROM tasks WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── TASK COMMENTS ────────────────────────────────────────────────
app.post('/api/comments', authMiddleware, async (req, res) => {
  try {
    const { task_id, text } = req.body
    if (!task_id || !text) return res.status(400).json({ error: 'Faltan campos' })
    const projectId = await getTaskProject(task_id)
    if (!projectId || !await isMember(projectId, req.user.id)) return forbidden(res)
    const r = await db.query(
      'INSERT INTO task_comments (task_id, author, text) VALUES ($1, $2, $3) RETURNING *',
      [task_id, req.user.name, text]
    )
    res.json(r.rows[0])
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.put('/api/comments/:id', authMiddleware, async (req, res) => {
  try {
    const projectId = await getCommentProject(req.params.id)
    if (!projectId || !await isMember(projectId, req.user.id)) return forbidden(res)
    await db.query('UPDATE task_comments SET text=$1 WHERE id=$2', [req.body.text, req.params.id])
    res.json((await db.query('SELECT * FROM task_comments WHERE id=$1', [req.params.id])).rows[0])
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/comments/:id', authMiddleware, async (req, res) => {
  try {
    const projectId = await getCommentProject(req.params.id)
    if (!projectId || !await isMember(projectId, req.user.id)) return forbidden(res)
    await db.query('DELETE FROM task_comments WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── PROJECT NOTES ────────────────────────────────────────────────
app.post('/api/project-notes', authMiddleware, async (req, res) => {
  try {
    const { project_id, text } = req.body
    if (!project_id || !text) return res.status(400).json({ error: 'Faltan campos' })
    if (!await isMember(project_id, req.user.id)) return forbidden(res)
    const r = await db.query(
      'INSERT INTO project_notes (project_id, author, text) VALUES ($1, $2, $3) RETURNING *',
      [project_id, req.user.name, text]
    )
    res.json(r.rows[0])
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.put('/api/project-notes/:id', authMiddleware, async (req, res) => {
  try {
    const projectId = await getNoteProject(req.params.id)
    if (!projectId || !await isMember(projectId, req.user.id)) return forbidden(res)
    await db.query('UPDATE project_notes SET text=$1 WHERE id=$2', [req.body.text, req.params.id])
    res.json((await db.query('SELECT * FROM project_notes WHERE id=$1', [req.params.id])).rows[0])
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/project-notes/:id', authMiddleware, async (req, res) => {
  try {
    const projectId = await getNoteProject(req.params.id)
    if (!projectId || !await isMember(projectId, req.user.id)) return forbidden(res)
    await db.query('DELETE FROM project_notes WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── MOVER nota → comentario de tarea ─────────────────────────────
app.post('/api/project-notes/:id/move-to-task', authMiddleware, async (req, res) => {
  try {
    const { task_id } = req.body
    if (!task_id) return res.status(400).json({ error: 'task_id requerido' })
    const note = (await db.query('SELECT * FROM project_notes WHERE id=$1', [req.params.id])).rows[0]
    if (!note) return res.status(404).json({ error: 'Nota no encontrada' })
    if (!await isMember(note.project_id, req.user.id)) return forbidden(res)
    const r = await db.query(
      'INSERT INTO task_comments (task_id, author, text, created_at) VALUES ($1, $2, $3, $4) RETURNING *',
      [task_id, note.author, note.text, note.created_at]
    )
    await db.query('DELETE FROM project_notes WHERE id=$1', [req.params.id])
    res.json({ comment: r.rows[0], deletedNoteId: Number(req.params.id) })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── MOVER comentario → nota de proyecto ──────────────────────────
app.post('/api/comments/:id/move-to-project', authMiddleware, async (req, res) => {
  try {
    const { project_id } = req.body
    if (!project_id) return res.status(400).json({ error: 'project_id requerido' })
    const comment = (await db.query('SELECT * FROM task_comments WHERE id=$1', [req.params.id])).rows[0]
    if (!comment) return res.status(404).json({ error: 'Comentario no encontrado' })
    if (!await isMember(project_id, req.user.id)) return forbidden(res)
    const r = await db.query(
      'INSERT INTO project_notes (project_id, author, text, created_at) VALUES ($1, $2, $3, $4) RETURNING *',
      [project_id, comment.author, comment.text, comment.created_at]
    )
    await db.query('DELETE FROM task_comments WHERE id=$1', [req.params.id])
    res.json({ note: r.rows[0], deletedCommentId: Number(req.params.id) })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── BACKUP / RESTORE ─────────────────────────────────────────────
app.get('/api/backup', authMiddleware, async (req, res) => {
  try {
    const projects      = (await db.query('SELECT * FROM projects ORDER BY id')).rows
    const tasks         = (await db.query('SELECT * FROM tasks ORDER BY id')).rows
    const task_comments = (await db.query('SELECT * FROM task_comments ORDER BY id')).rows
    const project_notes = (await db.query('SELECT * FROM project_notes ORDER BY id')).rows
    const backup = { version: 1, exported_at: new Date().toISOString(), data: { projects, tasks, task_comments, project_notes } }
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="flowtracker_backup_${new Date().toISOString().slice(0,10)}.json"`)
    res.json(backup)
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/restore', authMiddleware, async (req, res) => {
  try {
    const { version, data } = req.body
    if (!version || !data) return res.status(400).json({ error: 'Formato de backup inválido' })
    const { projects, tasks, task_comments, project_notes } = data
    await db.query('DELETE FROM task_comments')
    await db.query('DELETE FROM project_notes')
    await db.query('DELETE FROM tasks')
    await db.query('DELETE FROM project_members')
    await db.query('DELETE FROM projects')
    for (const p of projects) {
      await db.query('INSERT INTO projects (id, name, color, archived, created_at) VALUES ($1,$2,$3,$4,$5)', [p.id, p.name, p.color, p.archived||false, p.created_at])
      await db.query('INSERT INTO project_members (project_id, user_id, role) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [p.id, req.user.id, 'owner'])
    }
    for (const t of tasks) await db.query('INSERT INTO tasks (id, project_id, title, responsible, created_at, due_date, done, done_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [t.id, t.project_id, t.title, t.responsible||null, t.created_at, t.due_date||null, t.done||false, t.done_at||null])
    for (const c of task_comments) await db.query('INSERT INTO task_comments (id, task_id, author, text, created_at) VALUES ($1,$2,$3,$4,$5)', [c.id, c.task_id, c.author||null, c.text, c.created_at])
    for (const n of project_notes) await db.query('INSERT INTO project_notes (id, project_id, text, author, created_at) VALUES ($1,$2,$3,$4,$5)', [n.id, n.project_id, n.text, n.author||null, n.created_at])
    await db.query("SELECT setval('projects_id_seq',      COALESCE((SELECT MAX(id) FROM projects), 1))")
    await db.query("SELECT setval('tasks_id_seq',         COALESCE((SELECT MAX(id) FROM tasks), 1))")
    await db.query("SELECT setval('task_comments_id_seq', COALESCE((SELECT MAX(id) FROM task_comments), 1))")
    await db.query("SELECT setval('project_notes_id_seq', COALESCE((SELECT MAX(id) FROM project_notes), 1))")
    res.json({ ok: true, restored: { projects: projects.length, tasks: tasks.length, task_comments: task_comments.length, project_notes: project_notes.length } })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// ── Start ────────────────────────────────────────────────────────
initDB().then(() => {
  app.listen(PORT, () => console.log(`✅ FlowTracker API corriendo en http://localhost:${PORT}`))
}).catch(err => {
  console.error('❌ Error iniciando BD:', err.message)
  process.exit(1)
})
