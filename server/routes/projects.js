const { route, fail } = require('../http')
const v = require('../validation')
const access = require('../access')
const { transaction } = require('../db')
module.exports = function projectRoutes(app, { db, auth, store }) {
  async function list(req, res, archived) {
    const { limit, after } = v.pagination(req.query)
    const meetingId = req.query.meeting_id ? v.id(req.query.meeting_id) : null
    if (meetingId) await access(db).meeting(meetingId, req.user.id)
    const result = await db.query(
      `SELECT p.id FROM projects p JOIN project_members pm ON pm.project_id=p.id
      WHERE pm.user_id=$1 AND p.archived=$2 AND p.id>$3
      AND ${meetingId ? 'p.meeting_id=$5' : 'p.meeting_id IS NULL'} ORDER BY p.id LIMIT $4`,
      [req.user.id, archived, after, limit + 1, ...(meetingId ? [meetingId] : [])]
    )
    const more = result.rows.length > limit
    const ids = result.rows.slice(0, limit).map((r) => r.id)
    res.json({
      items: await store.getFullProjects(ids, { history: req.query.history !== 'none' }),
      nextCursor: more ? ids.at(-1) : null,
    })
  }
  app.get(
    '/api/projects',
    auth.requireAuth,
    route((req, res) => list(req, res, false))
  )
  app.get(
    '/api/projects/archived',
    auth.requireAuth,
    route((req, res) => list(req, res, true))
  )
  app.get(
    '/api/projects/:id',
    auth.requireAuth,
    route(async (req, res) => {
      const id = v.id(req.params.id)
      await access(db).member(id, req.user.id)
      res.json(await store.getFullProject(id))
    })
  )
  app.post(
    '/api/projects',
    auth.requireAuth,
    route(async (req, res) => {
      const name = v.text(req.body.name, 'name', 200),
        color = v.color(req.body.color)
      const meetingId = req.body.meeting_id ? v.id(req.body.meeting_id) : null
      const projectId = await transaction(db, async (client) => {
        if (meetingId) await access(client).meeting(meetingId, req.user.id)
        const p = (
          await client.query(
            'INSERT INTO projects (name,color,owner_id,meeting_id) VALUES ($1,$2,$3,$4) RETURNING id',
            [name, color, req.user.id, meetingId]
          )
        ).rows[0]
        await client.query(
          "INSERT INTO project_members (project_id,user_id,role) VALUES ($1,$2,'owner')",
          [p.id, req.user.id]
        )
        return p.id
      })
      res.status(201).json(await store.getFullProject(projectId))
    })
  )
  app.put(
    '/api/projects/:id',
    auth.requireAuth,
    route(async (req, res) => {
      const id = v.id(req.params.id)
      await access(db).member(id, req.user.id)
      await db.query('UPDATE projects SET name=$1,color=$2 WHERE id=$3', [
        v.text(req.body.name, 'name', 200),
        v.color(req.body.color),
        id,
      ])
      res.json(await store.getFullProject(id))
    })
  )
  for (const [action, archived] of [
    ['archive', true],
    ['unarchive', false],
  ])
    app.patch(
      `/api/projects/:id/${action}`,
      auth.requireAuth,
      route(async (req, res) => {
        const id = v.id(req.params.id)
        await access(db).member(id, req.user.id)
        await db.query('UPDATE projects SET archived=$1 WHERE id=$2', [archived, id])
        res.json(archived ? { ok: true } : await store.getFullProject(id))
      })
    )
  app.delete(
    '/api/projects/:id',
    auth.requireAuth,
    route(async (req, res) => {
      const id = v.id(req.params.id)
      await access(db).owner(id, req.user.id)
      await db.query('DELETE FROM projects WHERE id=$1', [id])
      res.json({ ok: true })
    })
  )
  app.get(
    '/api/users/search',
    auth.requireAuth,
    route(async (req, res) => {
      const q = v.text(req.query.q, 'q', 120, true)
      if (!q || q.length < 2) return res.json([])
      // Treat wildcard input literally.
      const pattern = '%' + q.toLowerCase().replace(/[\\%_]/g, '\\$&') + '%'
      res.json(
        (
          await db.query(
            'SELECT id,name,email FROM users WHERE (LOWER(email) LIKE $1 OR LOWER(name) LIKE $1) AND id!=$2 ORDER BY name,id LIMIT 10',
            [pattern, req.user.id]
          )
        ).rows
      )
    })
  )
  app.post(
    '/api/projects/:id/members',
    auth.requireAuth,
    route(async (req, res) => {
      const id = v.id(req.params.id),
        userId = v.id(req.body.user_id, 'user_id')
      const p = await access(db).owner(id, req.user.id)
      if (p.meeting_id) fail(400, 'Los temas de reunión no se comparten')
      await db.query(
        "INSERT INTO project_members (project_id,user_id,role) VALUES ($1,$2,'member') ON CONFLICT DO NOTHING",
        [id, userId]
      )
      res.json(await store.getFullProject(id))
    })
  )
  app.delete(
    '/api/projects/:id/members/:userId',
    auth.requireAuth,
    route(async (req, res) => {
      const id = v.id(req.params.id),
        userId = v.id(req.params.userId)
      const p = await access(db).owner(id, req.user.id)
      if (userId === p.owner_id) fail(400, 'No se puede quitar al propietario')
      await db.query('DELETE FROM project_members WHERE project_id=$1 AND user_id=$2', [id, userId])
      res.json(await store.getFullProject(id))
    })
  )
}
