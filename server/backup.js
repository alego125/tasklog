const v = require('./validation')
const { transaction } = require('./db')

function validateBackup(input) {
  if (!input || ![1, 2].includes(input.version) || !input.data || typeof input.data !== 'object')
    v.bad('backup/version')
  const legacy = input.version === 1,
    d = input.data
  const arrays = {}
  for (const key of [
    'meetings',
    'projects',
    'tasks',
    'task_comments',
    'project_notes',
    'project_members',
  ]) {
    const rows =
      d[key] ?? (legacy && ['meetings', 'project_members'].includes(key) ? [] : undefined)
    if (!Array.isArray(rows) || rows.length > 50000) v.bad(key)
    arrays[key] = rows
  }
  if (Object.values(arrays).reduce((n, rows) => n + rows.length, 0) > 100000)
    v.bad('demasiados registros')
  const maps = {}
  for (const key of ['meetings', 'projects', 'tasks', 'task_comments', 'project_notes']) {
    maps[key] = new Set()
    for (const row of arrays[key]) {
      if (!row || typeof row !== 'object') v.bad(key)
      row.id = v.id(row.id)
      if (maps[key].has(row.id)) v.bad(`id duplicado en ${key}`)
      maps[key].add(row.id)
    }
  }
  const ref = (set, value, name) => {
    const id = v.id(value, name)
    if (!set.has(id)) v.bad(name)
    return id
  }
  const base = (row) => ({ id: row.id, created_at: v.timestamp(row.created_at, 'created_at') })
  const meetings = arrays.meetings.map((row) => ({
    ...base(row),
    name: v.text(row.name, 'name', 200),
    color: v.color(row.color),
    archived: v.boolean(row.archived ?? false, 'archived'),
  }))
  const projects = arrays.projects.map((row) => ({
    ...base(row),
    name: v.text(row.name, 'name', 200),
    color: v.color(row.color),
    archived: v.boolean(row.archived ?? false, 'archived'),
    meeting_id:
      legacy || row.meeting_id == null ? null : ref(maps.meetings, row.meeting_id, 'meeting_id'),
  }))
  const tasks = arrays.tasks.map((row) => ({
    ...base(row),
    project_id: ref(maps.projects, row.project_id, 'project_id'),
    title: v.text(row.title, 'title', 500),
    responsible: v.text(row.responsible, 'responsible', 120, true),
    due_date: v.date(row.due_date, 'due_date'),
    done: v.boolean(row.done ?? false, 'done'),
    done_at: v.date(row.done_at, 'done_at'),
    priority: v.priority(row.priority),
  }))
  const notes = (key) =>
    arrays[key].map((row) => ({
      ...base(row),
      text: v.text(row.text, 'text', 20000),
      author: v.text(row.author, 'author', 120, true),
      ...(key === 'task_comments'
        ? { task_id: ref(maps.tasks, row.task_id, 'task_id') }
        : { project_id: ref(maps.projects, row.project_id, 'project_id') }),
    }))
  const memberships = new Set()
  const project_members = arrays.project_members.map((row) => {
    const project_id = ref(maps.projects, row.project_id, 'project_id'),
      email = v.text(row.email, 'email', 254).toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !['owner', 'member'].includes(row.role))
      v.bad('membresía')
    const key = `${project_id}:${email}`
    if (memberships.has(key)) v.bad('membresía duplicada')
    memberships.add(key)
    return { project_id, email, role: row.role, joined_at: v.timestamp(row.joined_at, 'joined_at') }
  })
  return {
    legacy,
    meetings,
    projects,
    tasks,
    task_comments: notes('task_comments'),
    project_notes: notes('project_notes'),
    project_members,
  }
}

async function exportBackup(db, user) {
  return transaction(
    db,
    async (client) => {
      const meetings = (
        await client.query('SELECT * FROM meetings WHERE owner_id=$1 ORDER BY id', [user.id])
      ).rows
      const projects = (
        await client.query(
          `SELECT p.* FROM projects p JOIN project_members pm ON pm.project_id=p.id
      LEFT JOIN meetings m ON m.id=p.meeting_id WHERE pm.user_id=$1 AND (p.meeting_id IS NULL OR m.owner_id=$1) ORDER BY p.id`,
          [user.id]
        )
      ).rows
      const ids = projects.map((p) => p.id)
      const tasks = (
        await client.query('SELECT * FROM tasks WHERE project_id=ANY($1::int[]) ORDER BY id', [ids])
      ).rows
      const task_comments = (
        await client.query('SELECT * FROM task_comments WHERE task_id=ANY($1::int[]) ORDER BY id', [
          tasks.map((t) => t.id),
        ])
      ).rows
      const project_notes = (
        await client.query(
          'SELECT * FROM project_notes WHERE project_id=ANY($1::int[]) ORDER BY id',
          [ids]
        )
      ).rows
      const project_members = (
        await client.query(
          `SELECT pm.*,u.name,u.username,u.email FROM project_members pm JOIN users u ON u.id=pm.user_id WHERE pm.project_id=ANY($1::int[]) ORDER BY pm.project_id,pm.user_id`,
          [ids]
        )
      ).rows
      return {
        version: 2,
        exported_at: new Date().toISOString(),
        source_user: { id: user.id, email: user.email },
        data: { meetings, projects, tasks, task_comments, project_notes, project_members },
      }
    },
    { readOnly: true }
  )
}

async function restoreBackup(db, user, raw, { restoreMemberships = false } = {}) {
  const data = validateBackup(raw) // Validate every row/reference before acquiring a write connection.
  return transaction(db, async (client) => {
    const maps = { meetings: new Map(), projects: new Map(), tasks: new Map() }
    const missingMembers = new Set()
    for (const row of data.meetings) {
      const r = await client.query(
        'INSERT INTO meetings (name,color,archived,owner_id,created_at) VALUES ($1,$2,$3,$4,$5) RETURNING id',
        [row.name, row.color, row.archived, user.id, row.created_at]
      )
      maps.meetings.set(row.id, r.rows[0].id)
    }
    for (const row of data.projects) {
      const r = await client.query(
        'INSERT INTO projects (name,color,archived,owner_id,meeting_id,created_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
        [
          row.name,
          row.color,
          row.archived,
          user.id,
          maps.meetings.get(row.meeting_id) || null,
          row.created_at,
        ]
      )
      const id = r.rows[0].id
      maps.projects.set(row.id, id)
      await client.query(
        "INSERT INTO project_members (project_id,user_id,role) VALUES ($1,$2,'owner')",
        [id, user.id]
      )
    }
    for (const row of data.tasks) {
      const r = await client.query(
        'INSERT INTO tasks (project_id,title,responsible,created_at,due_date,done,done_at,priority) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
        [
          maps.projects.get(row.project_id),
          row.title,
          row.responsible,
          row.created_at,
          row.due_date,
          row.done,
          row.done_at,
          row.priority,
        ]
      )
      maps.tasks.set(row.id, r.rows[0].id)
    }
    for (const row of data.task_comments)
      await client.query(
        'INSERT INTO task_comments (task_id,author,text,created_at) VALUES ($1,$2,$3,$4)',
        [maps.tasks.get(row.task_id), row.author, row.text, row.created_at]
      )
    for (const row of data.project_notes)
      await client.query(
        'INSERT INTO project_notes (project_id,author,text,created_at) VALUES ($1,$2,$3,$4)',
        [maps.projects.get(row.project_id), row.author, row.text, row.created_at]
      )
    if (restoreMemberships)
      for (const member of data.project_members) {
        if (data.projects.find((p) => p.id === member.project_id)?.meeting_id) continue
        const target = (await client.query('SELECT id FROM users WHERE email=$1', [member.email]))
          .rows[0]
        if (!target) {
          missingMembers.add(member.email)
          continue
        }
        if (target.id === user.id) continue
        await client.query(
          "INSERT INTO project_members (project_id,user_id,role,joined_at) VALUES ($1,$2,'member',$3) ON CONFLICT DO NOTHING",
          [maps.projects.get(member.project_id), target.id, member.joined_at]
        )
      }
    return {
      ok: true,
      mode: 'copy',
      restored: Object.fromEntries(
        ['meetings', 'projects', 'tasks', 'task_comments', 'project_notes'].map((k) => [
          k,
          data[k].length,
        ])
      ),
      warnings: {
        legacy: data.legacy,
        membershipsRestored: restoreMemberships,
        missingMembers: [...missingMembers],
      },
    }
  })
}
module.exports = { validateBackup, exportBackup, restoreBackup }
