import { useState, useMemo, useCallback } from 'react'
import { api } from './useApi.js'
import { getStatus } from '../utils/helpers.js'

export function useProjects() {
  const [projects,          setProjects]          = useState([])
  const [loading,           setLoading]           = useState(true)
  const [error,             setError]             = useState(null)
  const [archivedProjects,  setArchivedProjects]  = useState([])
  const [loadingArchived,   setLoadingArchived]   = useState(false)

  // ── Load ────────────────────────────────────────────────────────
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

  // ── Computed ────────────────────────────────────────────────────
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

  // ── Helpers internos ────────────────────────────────────────────
  const mutTask = (pId, tId, fn) =>
    setProjects(prev => prev.map(p => p.id===pId ? { ...p, tasks:p.tasks.map(t => t.id===tId ? fn(t) : t) } : p))

  // ── Projects ────────────────────────────────────────────────────
  const doAddProject = async (name, color) => {
    if (!name.trim()) return
    const project = await api.createProject(name, color)
    setProjects(prev => [...prev, project])
  }

  const doSaveEditProject = async (project, name, color) => {
    const updated = await api.updateProject(project.id, name, color)
    setProjects(prev => prev.map(p => p.id===project.id ? { ...p, name:updated.name, color:updated.color } : p))
  }

  const doDeleteProject = async pId => {
    await api.deleteProject(pId)
    setProjects(prev => prev.filter(p => p.id !== pId))
    setArchivedProjects(prev => prev.filter(p => p.id !== pId))
  }

  const doArchiveProject = async pId => {
    await api.archiveProject(pId)
    setProjects(prev => prev.filter(p => p.id !== pId))
  }

  const doUnarchiveProject = async pId => {
    const project = await api.unarchiveProject(pId)
    setArchivedProjects(prev => prev.filter(p => p.id !== pId))
    setProjects(prev => [...prev, project])
  }

  // ── Members ─────────────────────────────────────────────────────
  const doAddMember = async (projectId, userId) => {
    const updated = await api.addMember(projectId, userId)
    setProjects(prev => prev.map(p => p.id === projectId ? updated : p))
  }

  const doRemoveMember = async (projectId, userId) => {
    const updated = await api.removeMember(projectId, userId)
    setProjects(prev => prev.map(p => p.id === projectId ? updated : p))
  }

  // ── Tasks ───────────────────────────────────────────────────────
  const doAddTask = async (projectId, task) => {
    const created = await api.createTask({ project_id:projectId, ...task })
    setProjects(prev => prev.map(p => p.id===projectId ? { ...p, tasks:[...p.tasks, created] } : p))
  }

  const doSaveEditTask = async (pId, taskId, form) => {
    const updated = await api.updateTask(taskId, form)
    mutTask(pId, taskId, t => ({ ...t, ...updated }))
  }

  const doToggle = async id => {
    const updated = await api.toggleTask(id)
    setProjects(prev => prev.map(p => ({ ...p, tasks:p.tasks.map(t => t.id===id ? { ...t, ...updated } : t) })))
  }

  const doDeleteTask = async (pId, tId) => {
    await api.deleteTask(tId)
    setProjects(prev => prev.map(p => p.id===pId ? { ...p, tasks:p.tasks.filter(t => t.id!==tId) } : p))
  }

  // ── Comments ────────────────────────────────────────────────────
  const doAddComment = async (pId, tId, text) => {
    if (!text.trim()) return
    const comment = await api.createComment({ task_id:tId, text })
    mutTask(pId, tId, t => ({ ...t, comments:[...t.comments, comment] }))
  }

  const doSaveEditComment = async (pId, tId, commentId, text) => {
    const updated = await api.updateComment(commentId, text)
    mutTask(pId, tId, t => ({ ...t, comments:t.comments.map(c => c.id===updated.id ? updated : c) }))
  }

  const doDeleteComment = async (pId, tId, cId) => {
    await api.deleteComment(cId)
    mutTask(pId, tId, t => ({ ...t, comments:t.comments.filter(c => c.id!==cId) }))
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
    const note = await api.createProjectNote({ project_id:pId, text })
    setProjects(prev => prev.map(p => p.id===pId ? { ...p, notes:[...(p.notes||[]), note] } : p))
  }

  const doSaveEditNote = async (pId, noteId, text) => {
    const updated = await api.updateProjectNote(noteId, text)
    setProjects(prev => prev.map(p => p.id===pId
      ? { ...p, notes:(p.notes||[]).map(n => n.id===updated.id ? updated : n) } : p))
  }

  const doDeleteProjectNote = async (pId, nId) => {
    await api.deleteProjectNote(nId)
    setProjects(prev => prev.map(p => p.id===pId
      ? { ...p, notes:(p.notes||[]).filter(n => n.id!==nId) } : p))
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
    const BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'
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
    // state
    projects, setProjects, loading, error, archivedProjects, loadingArchived,
    // computed
    allTasks, sortedProjects,
    // loaders
    loadProjects, loadArchived,
    // projects
    doAddProject, doSaveEditProject, doDeleteProject, doArchiveProject, doUnarchiveProject,
    // members
    doAddMember, doRemoveMember,
    // tasks
    doAddTask, doSaveEditTask, doToggle, doDeleteTask,
    // comments
    doAddComment, doSaveEditComment, doDeleteComment, doMoveCommentToProject,
    // notes
    doAddProjectNote, doSaveEditNote, doDeleteProjectNote, doMoveNoteToTask,
    // backup
    doBackup, doRestore,
  }
}
