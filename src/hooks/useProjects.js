import { useState, useMemo, useCallback } from 'react'
import { api } from './useApi.js'
import { getStatus } from '../utils/helpers.js'

let _tempId = -1
const tempId = () => _tempId--

export function useProjects() {
  const [projects,         setProjects]         = useState([])
  const [loading,          setLoading]          = useState(true)
  const [error,            setError]            = useState(null)
  const [archivedProjects, setArchivedProjects] = useState([])
  const [loadingArchived,  setLoadingArchived]  = useState(false)

  const loadProjects = useCallback(async () => {
    if (!localStorage.getItem('ft_token')) { setLoading(false); return }
    try {
      setLoading(true); setError(null)
      setProjects(await api.getProjects())
    } catch {
      setError('No se pudo conectar con el servidor.')
    } finally { setLoading(false) }
  }, [])

  const loadArchived = async () => {
    setLoadingArchived(true)
    try { setArchivedProjects(await api.getArchivedProjects()) }
    finally { setLoadingArchived(false) }
  }

  const allTasks = useMemo(() =>
    projects.flatMap(p => p.tasks.map(t => ({ ...t, projectId:p.id, projectName:p.name, projectColor:p.color }))),
    [projects])

  const sortedProjects = useMemo(() => [...projects].sort((a, b) => {
    const aOv = a.tasks.some(t => getStatus(t.due_date, t.done) === 'overdue')
    const bOv = b.tasks.some(t => getStatus(t.due_date, t.done) === 'overdue')
    if (aOv && !bOv) return -1
    if (!aOv && bOv) return 1
    return b.name.localeCompare(a.name, 'es', { sensitivity:'base' })
  }), [projects])

  const mutTask = (pId, tId, fn) =>
    setProjects(prev => prev.map(p => p.id===pId ? { ...p, tasks:p.tasks.map(t => t.id===tId ? fn(t) : t) } : p))

  // Optimistic helper: aplica cambio, llama API, revierte si falla
  const withRollback = async (optimisticFn, apiFn, rollbackFn) => {
    optimisticFn()
    try { return await apiFn() }
    catch(e) { rollbackFn(); throw e }
  }

  // ── Projects ────────────────────────────────────────────────────
  const doAddProject = async (name, color) => {
    if (!name.trim()) return
    const project = await api.createProject(name, color)
    setProjects(prev => [...prev, project])
  }

  const doSaveEditProject = async (project, name, color) => {
    const prev = { name: project.name, color: project.color }
    return withRollback(
      () => setProjects(ps => ps.map(p => p.id===project.id ? { ...p, name, color } : p)),
      () => api.updateProject(project.id, name, color),
      () => setProjects(ps => ps.map(p => p.id===project.id ? { ...p, ...prev } : p))
    )
  }

  const doDeleteProject = async pId => {
    const snapshot = projects
    return withRollback(
      () => { setProjects(prev => prev.filter(p => p.id!==pId)); setArchivedProjects(prev => prev.filter(p => p.id!==pId)) },
      () => api.deleteProject(pId),
      () => setProjects(snapshot)
    )
  }

  const doArchiveProject = async pId => {
    const snapshot = projects
    return withRollback(
      () => setProjects(prev => prev.filter(p => p.id!==pId)),
      () => api.archiveProject(pId),
      () => setProjects(snapshot)
    )
  }

  const doUnarchiveProject = async pId => {
    const project = await api.unarchiveProject(pId)
    setArchivedProjects(prev => prev.filter(p => p.id!==pId))
    setProjects(prev => [...prev, project])
  }

  // ── Members ─────────────────────────────────────────────────────
  const doAddMember = async (projectId, userId) => {
    const updated = await api.addMember(projectId, userId)
    setProjects(prev => prev.map(p => p.id===projectId ? updated : p))
  }

  const doRemoveMember = async (projectId, userId) => {
    const updated = await api.removeMember(projectId, userId)
    setProjects(prev => prev.map(p => p.id===projectId ? updated : p))
  }

  // ── Tasks ───────────────────────────────────────────────────────
  const doAddTask = async (projectId, task) => {
    const tid = tempId()
    const optimistic = { ...task, id:tid, project_id:projectId, done:false, comments:[], created_at:new Date().toISOString(), _optimistic:true }
    setProjects(prev => prev.map(p => p.id===projectId ? { ...p, tasks:[...p.tasks, optimistic] } : p))
    try {
      const created = await api.createTask({ project_id:projectId, ...task })
      setProjects(prev => prev.map(p => p.id===projectId
        ? { ...p, tasks:p.tasks.map(t => t.id===tid ? created : t) } : p))
    } catch(e) {
      setProjects(prev => prev.map(p => p.id===projectId
        ? { ...p, tasks:p.tasks.filter(t => t.id!==tid) } : p))
      throw e
    }
  }

  const doSaveEditTask = async (pId, taskId, form) => {
    const snapshot = projects
    return withRollback(
      () => mutTask(pId, taskId, t => ({ ...t, ...form })),
      () => api.updateTask(taskId, form),
      () => setProjects(snapshot)
    )
  }

  const doToggle = async id => {
    // Flip inmediato
    setProjects(prev => prev.map(p => ({
      ...p, tasks: p.tasks.map(t => t.id===id
        ? { ...t, done:!t.done, done_at:!t.done ? new Date().toISOString() : null }
        : t)
    })))
    try {
      const updated = await api.toggleTask(id)
      // Sincronizar con valor real
      setProjects(prev => prev.map(p => ({
        ...p, tasks: p.tasks.map(t => t.id===id ? { ...t, ...updated } : t)
      })))
    } catch(e) {
      // Revertir flip
      setProjects(prev => prev.map(p => ({
        ...p, tasks: p.tasks.map(t => t.id===id ? { ...t, done:!t.done } : t)
      })))
      throw e
    }
  }

  const doDeleteTask = async (pId, tId) => {
    const snapshot = projects
    return withRollback(
      () => setProjects(prev => prev.map(p => p.id===pId ? { ...p, tasks:p.tasks.filter(t => t.id!==tId) } : p)),
      () => api.deleteTask(tId),
      () => setProjects(snapshot)
    )
  }

  // ── Comments ────────────────────────────────────────────────────
  const doAddComment = async (pId, tId, text) => {
    if (!text.trim()) return
    const tid = tempId()
    const user = JSON.parse(localStorage.getItem('ft_user')||'{}')
    const optimistic = { id:tid, task_id:tId, text, author:user.name||'', created_at:new Date().toISOString(), _optimistic:true }
    mutTask(pId, tId, t => ({ ...t, comments:[...t.comments, optimistic] }))
    try {
      const comment = await api.createComment({ task_id:tId, text })
      mutTask(pId, tId, t => ({ ...t, comments:t.comments.map(c => c.id===tid ? comment : c) }))
    } catch(e) {
      mutTask(pId, tId, t => ({ ...t, comments:t.comments.filter(c => c.id!==tid) }))
      throw e
    }
  }

  const doSaveEditComment = async (pId, tId, commentId, text) => {
    const snapshot = projects
    return withRollback(
      () => mutTask(pId, tId, t => ({ ...t, comments:t.comments.map(c => c.id===commentId ? { ...c, text } : c) })),
      () => api.updateComment(commentId, text),
      () => setProjects(snapshot)
    )
  }

  const doDeleteComment = async (pId, tId, cId) => {
    const snapshot = projects
    return withRollback(
      () => mutTask(pId, tId, t => ({ ...t, comments:t.comments.filter(c => c.id!==cId) })),
      () => api.deleteComment(cId),
      () => setProjects(snapshot)
    )
  }

  const doMoveCommentToProject = async (comment, pId, tId, targetProjectId) => {
    const result = await api.moveCommentToProject(comment.id, targetProjectId)
    mutTask(pId, tId, t => ({ ...t, comments:t.comments.filter(c => c.id!==result.deletedCommentId) }))
    setProjects(prev => prev.map(p => p.id===targetProjectId
      ? { ...p, notes:[...(p.notes||[]), result.note] } : p))
  }

  // ── Notes ───────────────────────────────────────────────────────
  const doAddProjectNote = async (pId, text) => {
    if (!text.trim()) return
    const tid = tempId()
    const user = JSON.parse(localStorage.getItem('ft_user')||'{}')
    const optimistic = { id:tid, project_id:pId, text, author:user.name||'', created_at:new Date().toISOString(), _optimistic:true }
    setProjects(prev => prev.map(p => p.id===pId ? { ...p, notes:[...(p.notes||[]), optimistic] } : p))
    try {
      const note = await api.createProjectNote({ project_id:pId, text })
      setProjects(prev => prev.map(p => p.id===pId
        ? { ...p, notes:(p.notes||[]).map(n => n.id===tid ? note : n) } : p))
    } catch(e) {
      setProjects(prev => prev.map(p => p.id===pId
        ? { ...p, notes:(p.notes||[]).filter(n => n.id!==tid) } : p))
      throw e
    }
  }

  const doSaveEditNote = async (pId, noteId, text) => {
    const snapshot = projects
    return withRollback(
      () => setProjects(prev => prev.map(p => p.id===pId
        ? { ...p, notes:(p.notes||[]).map(n => n.id===noteId ? { ...n, text } : n) } : p)),
      () => api.updateProjectNote(noteId, text),
      () => setProjects(snapshot)
    )
  }

  const doDeleteProjectNote = async (pId, nId) => {
    const snapshot = projects
    return withRollback(
      () => setProjects(prev => prev.map(p => p.id===pId
        ? { ...p, notes:(p.notes||[]).filter(n => n.id!==nId) } : p)),
      () => api.deleteProjectNote(nId),
      () => setProjects(snapshot)
    )
  }

  const doMoveNoteToTask = async (note, pId, taskId, allTasks) => {
    const result = await api.moveNoteToTask(note.id, taskId)
    setProjects(prev => prev.map(p => p.id===pId
      ? { ...p, notes:(p.notes||[]).filter(n => n.id!==result.deletedNoteId) } : p))
    const task = allTasks.find(t => t.id===taskId)
    if (task) mutTask(task.projectId, taskId, t => ({ ...t, comments:[...t.comments, result.comment] }))
  }

  // ── Backup / Restore ────────────────────────────────────────────
  const doBackup = async () => {
    const BASE  = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'
    const token = localStorage.getItem('ft_token')
    const res   = await fetch(`${BASE}/backup`, { headers:{ Authorization:`Bearer ${token}` } })
    const blob  = await res.blob()
    const a     = document.createElement('a')
    a.href      = URL.createObjectURL(blob)
    a.download  = `flowtracker_backup_${new Date().toISOString().slice(0,10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const doRestore = async (file, onResult) => {
    if (!file) return
    onResult({ loading:true, msg:null })
    try {
      const text   = await file.text()
      const json   = JSON.parse(text)
      const BASE   = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'
      const token  = localStorage.getItem('ft_token')
      const res    = await fetch(`${BASE}/restore`, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body:JSON.stringify(json) })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)
      onResult({ loading:false, msg:{ ok:true, text:`✅ Restauración exitosa: ${result.restored.projects} proyectos, ${result.restored.tasks} tareas, ${result.restored.task_comments} comentarios, ${result.restored.project_notes} notas.` } })
      await loadProjects()
    } catch(e) {
      onResult({ loading:false, msg:{ ok:false, text:`❌ Error: ${e.message}` } })
    }
  }

  return {
    projects, setProjects, loading, error, archivedProjects, loadingArchived,
    allTasks, sortedProjects,
    loadProjects, loadArchived,
    doAddProject, doSaveEditProject, doDeleteProject, doArchiveProject, doUnarchiveProject,
    doAddMember, doRemoveMember,
    doAddTask, doSaveEditTask, doToggle, doDeleteTask,
    doAddComment, doSaveEditComment, doDeleteComment, doMoveCommentToProject,
    doAddProjectNote, doSaveEditNote, doDeleteProjectNote, doMoveNoteToTask,
    doBackup, doRestore,
  }
}
