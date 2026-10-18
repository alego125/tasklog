const { route } = require('../http')
const v = require('../validation')
const access = require('../access')
module.exports = function meetingRoutes(app, { db, auth, store }) {
  for (const [path, archived] of [
    ['/api/meetings', false],
    ['/api/meetings/archived', true],
  ])
    app.get(
      path,
      auth.requireAuth,
      route(async (req, res) => {
        const { limit, after } = v.pagination(req.query)
        const rows = (
          await db.query(
            'SELECT id FROM meetings WHERE owner_id=$1 AND archived=$2 AND id>$3 ORDER BY id LIMIT $4',
            [req.user.id, archived, after, limit + 1]
          )
        ).rows
        const ids = rows.slice(0, limit).map((r) => r.id)
        res.json({
          items: await store.getMeetingsSummary(ids),
          nextCursor: rows.length > limit ? ids.at(-1) : null,
        })
      })
    )
  app.post(
    '/api/meetings',
    auth.requireAuth,
    route(async (req, res) => {
      const id = (
        await db.query(
          'INSERT INTO meetings (name,color,owner_id) VALUES ($1,$2,$3) RETURNING id',
          [v.text(req.body.name, 'name', 200), v.color(req.body.color), req.user.id]
        )
      ).rows[0].id
      res.status(201).json((await store.getMeetingsSummary([id]))[0])
    })
  )
  app.put(
    '/api/meetings/:id',
    auth.requireAuth,
    route(async (req, res) => {
      const id = v.id(req.params.id)
      await access(db).meeting(id, req.user.id)
      await db.query('UPDATE meetings SET name=$1,color=$2 WHERE id=$3', [
        v.text(req.body.name, 'name', 200),
        v.color(req.body.color),
        id,
      ])
      res.json((await store.getMeetingsSummary([id]))[0])
    })
  )
  for (const [action, archived] of [
    ['archive', true],
    ['unarchive', false],
  ])
    app.patch(
      `/api/meetings/:id/${action}`,
      auth.requireAuth,
      route(async (req, res) => {
        const id = v.id(req.params.id)
        await access(db).meeting(id, req.user.id)
        await db.query('UPDATE meetings SET archived=$1 WHERE id=$2', [archived, id])
        res.json(archived ? { ok: true } : (await store.getMeetingsSummary([id]))[0])
      })
    )
  app.delete(
    '/api/meetings/:id',
    auth.requireAuth,
    route(async (req, res) => {
      const id = v.id(req.params.id)
      await access(db).meeting(id, req.user.id)
      await db.query('DELETE FROM meetings WHERE id=$1', [id])
      res.json({ ok: true })
    })
  )
  app.get(
    '/api/meetings/:id/export',
    auth.requireAuth,
    route(async (req, res) => {
      const id = v.id(req.params.id)
      await access(db).meeting(id, req.user.id)
      const ids = (
        await db.query('SELECT id FROM projects WHERE meeting_id=$1 ORDER BY id', [id])
      ).rows.map((p) => p.id)
      res.json({
        meeting: (await store.getMeetingsSummary([id]))[0],
        temas: await store.getFullProjects(ids),
      })
    })
  )
}
