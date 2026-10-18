const { denied, fail } = require('./http')
module.exports = function access(db) {
  async function member(projectId, userId) {
    // Meeting topics remain private even if a legacy membership exists.
    const r = await db.query(
      `SELECT p.* FROM projects p JOIN project_members pm ON pm.project_id=p.id
      LEFT JOIN meetings m ON m.id=p.meeting_id
      WHERE p.id=$1 AND pm.user_id=$2 AND (p.meeting_id IS NULL OR m.owner_id=$2)`,
      [projectId, userId]
    )
    if (!r.rows.length) denied()
    return r.rows[0]
  }
  async function owner(projectId, userId) {
    const p = await member(projectId, userId)
    if (p.owner_id !== userId) denied()
    return p
  }
  async function meeting(meetingId, userId) {
    const r = await db.query('SELECT * FROM meetings WHERE id=$1 AND owner_id=$2', [
      meetingId,
      userId,
    ])
    if (!r.rows.length) denied()
    return r.rows[0]
  }
  async function task(taskId, userId, { lock = false } = {}) {
    const t = (
      await db.query(`SELECT * FROM tasks WHERE id=$1${lock ? ' FOR UPDATE' : ''}`, [taskId])
    ).rows[0]
    if (!t) fail(404, 'Tarea no encontrada')
    await member(t.project_id, userId)
    return t
  }
  return { member, owner, meeting, task }
}
