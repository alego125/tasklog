const { route, fail } = require('../http')
const v = require('../validation')
const access = require('../access')
const { transaction } = require('../db')
module.exports = function noteRoutes(app, { db, auth }) {
  for (const [path, table, parentKey] of [
    ['comments', 'task_comments', 'task_id'],
    ['project-notes', 'project_notes', 'project_id'],
  ]) {
    async function authorize(client, row, userId) {
      if (parentKey === 'task_id') await access(client).task(row.task_id, userId)
      else await access(client).member(row.project_id, userId)
    }
    app.post(
      `/api/${path}`,
      auth.requireAuth,
      route(async (req, res) => {
        const parent = v.id(req.body[parentKey], parentKey),
          text = v.text(req.body.text, 'text', 20000)
        await authorize(db, { [parentKey]: parent }, req.user.id)
        const result = await db.query(
          `INSERT INTO ${table} (${parentKey},author,author_id,text) VALUES ($1,$2,$3,$4) RETURNING *`,
          [parent, req.user.name, req.user.id, text]
        )
        res.status(201).json(result.rows[0])
      })
    )
    app.put(
      `/api/${path}/:id`,
      auth.requireAuth,
      route(async (req, res) => {
        const id = v.id(req.params.id),
          text = v.text(req.body.text, 'text', 20000)
        const createdAt =
          req.body.created_at === undefined ? null : v.timestamp(req.body.created_at, 'created_at')
        const row = (await db.query(`SELECT * FROM ${table} WHERE id=$1`, [id])).rows[0]
        if (!row) fail(404, 'Nota no encontrada')
        await authorize(db, row, req.user.id)
        const result = await db.query(
          `UPDATE ${table} SET text=$1${createdAt ? ',created_at=$3' : ''} WHERE id=$2 RETURNING *`,
          [text, id, ...(createdAt ? [createdAt] : [])]
        )
        res.json(result.rows[0])
      })
    )
    app.delete(
      `/api/${path}/:id`,
      auth.requireAuth,
      route(async (req, res) => {
        const id = v.id(req.params.id),
          row = (await db.query(`SELECT * FROM ${table} WHERE id=$1`, [id])).rows[0]
        if (!row) fail(404, 'Nota no encontrada')
        await authorize(db, row, req.user.id)
        await db.query(`DELETE FROM ${table} WHERE id=$1`, [id])
        res.json({ ok: true })
      })
    )
  }
  app.post(
    '/api/project-notes/:id/move-to-task',
    auth.requireAuth,
    route(async (req, res) => {
      const id = v.id(req.params.id),
        taskId = v.id(req.body.task_id, 'task_id')
      res.json(
        await transaction(db, async (client) => {
          const note = (
            await client.query('SELECT * FROM project_notes WHERE id=$1 FOR UPDATE', [id])
          ).rows[0]
          if (!note) fail(404, 'Nota no encontrada')
          await access(client).member(note.project_id, req.user.id)
          await access(client).task(taskId, req.user.id)
          const comment = (
            await client.query(
              'INSERT INTO task_comments (task_id,author,author_id,text,created_at) VALUES ($1,$2,$3,$4,$5) RETURNING *',
              [taskId, note.author, note.author_id, note.text, note.created_at]
            )
          ).rows[0]
          await client.query('DELETE FROM project_notes WHERE id=$1', [id])
          return { comment, deletedNoteId: id }
        })
      )
    })
  )
  app.post(
    '/api/comments/:id/move-to-project',
    auth.requireAuth,
    route(async (req, res) => {
      const id = v.id(req.params.id),
        projectId = v.id(req.body.project_id, 'project_id')
      res.json(
        await transaction(db, async (client) => {
          const comment = (
            await client.query('SELECT * FROM task_comments WHERE id=$1 FOR UPDATE', [id])
          ).rows[0]
          if (!comment) fail(404, 'Comentario no encontrado')
          await access(client).task(comment.task_id, req.user.id)
          await access(client).member(projectId, req.user.id)
          const note = (
            await client.query(
              'INSERT INTO project_notes (project_id,author,author_id,text,created_at) VALUES ($1,$2,$3,$4,$5) RETURNING *',
              [projectId, comment.author, comment.author_id, comment.text, comment.created_at]
            )
          ).rows[0]
          await client.query('DELETE FROM task_comments WHERE id=$1', [id])
          return { note, deletedCommentId: id }
        })
      )
    })
  )
}
