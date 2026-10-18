const { route } = require('../http')
const v = require('../validation')
const access = require('../access')
const { transaction } = require('../db')
module.exports = function taskRoutes(app, { db, auth }) {
  const fullTask = async (client, task) => ({
    ...task,
    comments: (
      await client.query('SELECT * FROM task_comments WHERE task_id=$1 ORDER BY id', [task.id])
    ).rows,
  })
  app.post(
    '/api/tasks',
    auth.requireAuth,
    route(async (req, res) => {
      const t = v.task(req.body)
      await access(db).member(t.project_id, req.user.id)
      const task = (
        await db.query(
          'INSERT INTO tasks (project_id,title,responsible,due_date,priority) VALUES ($1,$2,$3,$4,$5) RETURNING *',
          [t.project_id, t.title, t.responsible || null, t.due_date || null, t.priority || null]
        )
      ).rows[0]
      res.status(201).json({ ...task, comments: [] })
    })
  )
  app.put(
    '/api/tasks/:id',
    auth.requireAuth,
    route(async (req, res) => {
      const id = v.id(req.params.id),
        patch = v.task(req.body, true)
      const task = await transaction(db, async (client) => {
        const existing = await access(client).task(id, req.user.id, { lock: true })
        if (patch.project_id && patch.project_id !== existing.project_id)
          await access(client).member(patch.project_id, req.user.id)
        // Column names come exclusively from the validation allowlist.
        const values = Object.values(patch),
          sets = Object.keys(patch).map((key, i) => `${key}=$${i + 1}`)
        const updated = (
          await client.query(
            `UPDATE tasks SET ${sets.join(',')} WHERE id=$${values.length + 1} RETURNING *`,
            [...values, id]
          )
        ).rows[0]
        return fullTask(client, updated)
      })
      res.json(task)
    })
  )
  app.patch(
    '/api/tasks/:id/toggle',
    auth.requireAuth,
    route(async (req, res) => {
      const id = v.id(req.params.id)
      res.json(
        await transaction(db, async (client) => {
          await access(client).task(id, req.user.id, { lock: true })
          const t = (
            await client.query(
              "UPDATE tasks SET done=NOT done,done_at=CASE WHEN NOT done THEN (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date ELSE NULL END WHERE id=$1 RETURNING *",
              [id]
            )
          ).rows[0]
          return fullTask(client, t)
        })
      )
    })
  )
  app.delete(
    '/api/tasks/:id',
    auth.requireAuth,
    route(async (req, res) => {
      const id = v.id(req.params.id)
      await access(db).task(id, req.user.id)
      await db.query('DELETE FROM tasks WHERE id=$1', [id])
      res.json({ ok: true })
    })
  )
}
