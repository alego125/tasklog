module.exports = function createProjectStore(db) {
  // ── Helper: proyecto completo (para operaciones individuales) ────
  async function getFullProject(id) {
    return (await getFullProjects([Number(id)]))[0] || null
  }

  // ── Helper: múltiples proyectos de una vez (para listados) ────────
  async function getFullProjects(projectIds, { history = true } = {}) {
    if (!projectIds.length) return []
    const ids = projectIds.map((_, i) => `$${i + 1}`).join(',')
    // 5 queries en paralelo para TODOS los proyectos juntos
    const [pRes, mRes, tRes, cRes, nRes] = await Promise.all([
      db.query(
        `SELECT p.*, u.name as owner_name FROM projects p
              LEFT JOIN users u ON u.id = p.owner_id
              WHERE p.id IN (${ids}) ORDER BY p.id`,
        projectIds
      ),
      db.query(
        `SELECT u.id, u.name, u.email, pm.role, pm.project_id FROM project_members pm
              JOIN users u ON u.id = pm.user_id WHERE pm.project_id IN (${ids})`,
        projectIds
      ),
      db.query(
        `SELECT t.*${history ? '' : ', (SELECT COUNT(*)::int FROM task_comments c WHERE c.task_id=t.id) AS comments_count'} FROM tasks t WHERE project_id IN (${ids}) ORDER BY created_at ASC`,
        projectIds
      ),
      history
        ? db.query(
            `SELECT * FROM task_comments WHERE task_id IN
              (SELECT id FROM tasks WHERE project_id IN (${ids})) ORDER BY id`,
            projectIds
          )
        : Promise.resolve({ rows: [] }),
      history
        ? db.query(
            `SELECT * FROM project_notes WHERE project_id IN (${ids}) ORDER BY created_at ASC`,
            projectIds
          )
        : db.query(
            `SELECT project_id,COUNT(*)::int AS notes_count FROM project_notes WHERE project_id IN (${ids}) GROUP BY project_id`,
            projectIds
          ),
    ])
    // Agrupar en memoria
    const membersMap = {}
    const tasksMap = {}
    const commentsMap = {}
    const notesMap = {}
    for (const m of mRes.rows) {
      if (!membersMap[m.project_id]) membersMap[m.project_id] = []
      membersMap[m.project_id].push(m)
    }
    for (const t of tRes.rows) {
      if (!tasksMap[t.project_id]) tasksMap[t.project_id] = []
      tasksMap[t.project_id].push(t)
    }
    for (const c of cRes.rows) {
      if (!commentsMap[c.task_id]) commentsMap[c.task_id] = []
      commentsMap[c.task_id].push(c)
    }
    for (const n of nRes.rows) {
      if (!notesMap[n.project_id]) notesMap[n.project_id] = []
      notesMap[n.project_id].push(n)
    }
    return pRes.rows.map((p) => ({
      ...p,
      members: membersMap[p.id] || [],
      tasks: (tasksMap[p.id] || []).map((t) => ({ ...t, comments: commentsMap[t.id] || [] })),
      notes: history ? notesMap[p.id] || [] : [],
      notes_count: history ? (notesMap[p.id] || []).length : notesMap[p.id]?.[0]?.notes_count || 0,
      history_loaded: history,
    }))
  }

  // ── Helper: resumen de reuniones (una sola query agregada, sin N+1) ─
  async function getMeetingsSummary(meetingIds) {
    if (!meetingIds.length) return []
    const ids = meetingIds.map((_, i) => `$${i + 1}`).join(',')
    const r = await db.query(
      `
    SELECT m.*, COALESCE(p.temas_count,0) AS temas_count,
      COALESCE(t.tasks_pending,0) AS tasks_pending, COALESCE(t.tasks_done,0) AS tasks_done,
      COALESCE(n.notes_count,0) AS notes_count
    FROM meetings m
    LEFT JOIN (SELECT meeting_id,COUNT(*) AS temas_count FROM projects GROUP BY meeting_id) p ON p.meeting_id=m.id
    LEFT JOIN (SELECT p.meeting_id,COUNT(*) FILTER (WHERE NOT t.done) AS tasks_pending,
      COUNT(*) FILTER (WHERE t.done) AS tasks_done FROM tasks t JOIN projects p ON p.id=t.project_id GROUP BY p.meeting_id) t ON t.meeting_id=m.id
    LEFT JOIN (SELECT p.meeting_id,COUNT(*) AS notes_count FROM project_notes n JOIN projects p ON p.id=n.project_id GROUP BY p.meeting_id) n ON n.meeting_id=m.id
    WHERE m.id IN (${ids}) ORDER BY m.id
  `,
      meetingIds
    )
    return r.rows.map((m) => ({
      ...m,
      temas_count: Number(m.temas_count),
      tasks_pending: Number(m.tasks_pending),
      tasks_done: Number(m.tasks_done),
      notes_count: Number(m.notes_count),
    }))
  }

  return { getFullProject, getFullProjects, getMeetingsSummary }
}
