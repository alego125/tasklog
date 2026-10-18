import { useArchivedCollection } from './useArchivedCollection.js'
import { useMemo, useRef } from 'react'
import { api } from './useApi.js'
import { useSyncedCollection } from './useSyncedCollection.js'
import { getStatus } from '../utils/helpers.js'
import { download } from '../utils/download.js'

export function useProjects(meetingId) {
  const hydrated = useRef(new Set())
  const allHistory = useRef(false)
  const hydration = useRef(null)
  const state = useSyncedCollection(async () => {
    const items = await api.getProjects(meetingId, allHistory.current)
    if (!allHistory.current) {
      // Refresh only the history that the user has opened, at most four requests at a time.
      for (let i = 0; i < items.length; i += 4) {
        const chunk = await Promise.all(
          items.slice(i, i + 4).map((p) => (hydrated.current.has(p.id) ? api.getProject(p.id) : p))
        )
        items.splice(i, chunk.length, ...chunk)
      }
    }
    return items
  })
  const { items: projects, setItems: setProjects, mutate } = state
  const archived = useArchivedCollection(() => api.getArchivedProjects(meetingId))
  const {
    items: archivedProjects,
    setItems: setArchivedProjects,
    loading: loadingArchived,
    error: archiveError,
    load: loadArchived,
  } = archived
  const loadProjects = state.load
  const allTasks = useMemo(
    () =>
      projects.flatMap((p) =>
        p.tasks.map((t) => ({ ...t, projectId: p.id, projectName: p.name, projectColor: p.color }))
      ),
    [projects]
  )
  const sortedProjects = useMemo(() => {
    const category = (p) => {
      const pending = p.tasks.filter((t) => !t.done)
      if (pending.some((t) => getStatus(t.due_date, false) === 'overdue')) return 0
      if (pending.some((t) => getStatus(t.due_date, false) === 'warning')) return 1
      if (pending.some((t) => t.due_date)) return 2
      return pending.length ? 3 : 4
    }
    return [...projects].sort(
      (a, b) =>
        category(a) - category(b) ||
        (b.created_at || '').localeCompare(a.created_at || '') ||
        b.id - a.id
    )
  }, [projects])
  const ensureProjectHistory = (id) =>
    mutate(
      async () => {
        const project = await api.getProject(id)
        hydrated.current.add(id)
        return project
      },
      (items, p) => items.map((x) => (x.id === p.id ? p : x))
    )
  const ensureAllHistory = () => {
    if (hydration.current) return hydration.current
    allHistory.current = true
    hydration.current = mutate(
      () => api.getProjects(meetingId, true),
      (_items, items) => items
    ).finally(() => {
      hydration.current = null
    })
    return hydration.current
  }
  const replaceProject = (items, project) => items.map((p) => (p.id === project.id ? project : p))
  const mapTask = (items, id, fn) =>
    items.map((p) => ({ ...p, tasks: p.tasks.map((t) => (t.id === id ? fn(t) : t)) }))
  const doAddProject = (name, color) =>
    mutate(
      async () => {
        const p = await api.createProject(name.trim(), color, meetingId)
        hydrated.current.add(p.id)
        return p
      },
      (items, p) => [...items, p]
    )
  const doSaveEditProject = (project, name, color) =>
    mutate(() => api.updateProject(project.id, name, color), replaceProject)
  const doDeleteProject = (pId) =>
    mutate(
      async () => {
        const r = await api.deleteProject(pId)
        setArchivedProjects((prev) => prev.filter((p) => p.id !== pId))
        return r
      },
      (items) => items.filter((p) => p.id !== pId)
    )
  const doArchiveProject = (pId) =>
    mutate(
      () => api.archiveProject(pId),
      (items) => items.filter((p) => p.id !== pId)
    )
  const doUnarchiveProject = (pId) =>
    mutate(
      async () => {
        const p = await api.unarchiveProject(pId)
        setArchivedProjects((prev) => prev.filter((x) => x.id !== pId))
        return p
      },
      (items, p) => [...items.filter((x) => x.id !== p.id), p]
    )
  const doAddMember = (pId, uId) => mutate(() => api.addMember(pId, uId), replaceProject)
  const doRemoveMember = (pId, uId) => mutate(() => api.removeMember(pId, uId), replaceProject)
  const doAddTask = (pId, data) =>
    mutate(
      () => api.createTask({ ...data, project_id: pId }),
      (items, t) => items.map((p) => (p.id === pId ? { ...p, tasks: [...p.tasks, t] } : p))
    )
  const doSaveEditTask = (_pId, id, data) =>
    mutate(
      () => api.updateTask(id, data),
      (items, t) =>
        items.map((p) => ({
          ...p,
          tasks:
            p.id === t.project_id
              ? [...p.tasks.filter((x) => x.id !== id), t]
              : p.tasks.filter((x) => x.id !== id),
        }))
    )
  const doToggle = (id) =>
    mutate(
      () => api.toggleTask(id),
      (items, t) => mapTask(items, id, () => t)
    )
  const doDeleteTask = (_pId, id) =>
    mutate(
      () => api.deleteTask(id),
      (items) => items.map((p) => ({ ...p, tasks: p.tasks.filter((t) => t.id !== id) }))
    )
  const doAddComment = (_pId, tId, text) =>
    mutate(
      () => api.createComment({ task_id: tId, text }),
      (items, c) => mapTask(items, tId, (t) => ({ ...t, comments: [...t.comments, c] }))
    )
  const doSaveEditComment = (_pId, tId, id, data) =>
    mutate(
      () => api.updateComment(id, data),
      (items, c) =>
        mapTask(items, tId, (t) => ({
          ...t,
          comments: t.comments.map((x) => (x.id === id ? c : x)),
        }))
    )
  const doDeleteComment = (_pId, tId, id) =>
    mutate(
      () => api.deleteComment(id),
      (items) =>
        mapTask(items, tId, (t) => ({ ...t, comments: t.comments.filter((c) => c.id !== id) }))
    )
  const doMoveCommentToProject = (comment, _pId, tId, targetId) =>
    mutate(
      () => api.moveCommentToProject(comment.id, targetId),
      (items, r) =>
        mapTask(items, tId, (t) => ({
          ...t,
          comments: t.comments.filter((c) => c.id !== r.deletedCommentId),
        })).map((p) =>
          p.id === targetId
            ? {
                ...p,
                notes: [...p.notes, r.note],
                notes_count: (p.notes_count ?? p.notes.length) + 1,
              }
            : p
        )
    )
  const doAddProjectNote = (pId, text) =>
    mutate(
      () => api.createProjectNote({ project_id: pId, text }),
      (items, n) =>
        items.map((p) =>
          p.id === pId
            ? { ...p, notes: [...p.notes, n], notes_count: (p.notes_count ?? p.notes.length) + 1 }
            : p
        )
    )
  const doSaveEditNote = (pId, id, data) =>
    mutate(
      () => api.updateProjectNote(id, data),
      (items, n) =>
        items.map((p) =>
          p.id === pId ? { ...p, notes: p.notes.map((x) => (x.id === id ? n : x)) } : p
        )
    )
  const doDeleteProjectNote = (pId, id) =>
    mutate(
      () => api.deleteProjectNote(id),
      (items) =>
        items.map((p) =>
          p.id === pId
            ? {
                ...p,
                notes: p.notes.filter((n) => n.id !== id),
                notes_count: Math.max(0, (p.notes_count ?? p.notes.length) - 1),
              }
            : p
        )
    )
  const doMoveNoteToTask = (note, pId, tId) =>
    mutate(
      () => api.moveNoteToTask(note.id, tId),
      (items, r) =>
        mapTask(items, tId, (t) => ({ ...t, comments: [...t.comments, r.comment] })).map((p) =>
          p.id === pId
            ? {
                ...p,
                notes: p.notes.filter((n) => n.id !== r.deletedNoteId),
                notes_count: Math.max(0, (p.notes_count ?? p.notes.length) - 1),
              }
            : p
        )
    )
  const doBackup = async () =>
    download(
      JSON.stringify(await api.backup(), null, 2),
      `tasklog_backup_${new Date().toISOString().slice(0, 10)}.json`,
      'application/json'
    )
  return {
    ensureProjectHistory,
    ensureAllHistory,
    projects,
    setProjects,
    loading: state.loading,
    error: state.error,
    pending: state.pending,
    lastUpdated: state.lastUpdated,
    archivedProjects,
    loadingArchived,
    archiveError,
    allTasks,
    sortedProjects,
    loadProjects,
    loadArchived,
    doAddProject,
    doSaveEditProject,
    doDeleteProject,
    doArchiveProject,
    doUnarchiveProject,
    doAddMember,
    doRemoveMember,
    doAddTask,
    doSaveEditTask,
    doToggle,
    doDeleteTask,
    doAddComment,
    doSaveEditComment,
    doDeleteComment,
    doMoveCommentToProject,
    doAddProjectNote,
    doSaveEditNote,
    doDeleteProjectNote,
    doMoveNoteToTask,
    doBackup,
  }
}
