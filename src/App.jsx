import Icon from './components/Icon.jsx'
import WorkspaceToolbar from './components/WorkspaceToolbar.jsx'
import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react'
import { api, isNetworkError } from './hooks/useApi.js'
import { useProjects } from './hooks/useProjects.js'
import { useMeetings } from './hooks/useMeetings.js'
import { useProjectFilters } from './hooks/useProjectFilters.js'
import MembersDialog from './components/MembersDialog.jsx'
import { useSession } from './hooks/useSession.js'
import RestoreBackup from './components/RestoreBackup.jsx'
import { useToast } from './hooks/useToast.js'
import Toast from './components/Toast.jsx'
import { getStatus, COLORS, S, fmtDate } from './utils/helpers.js'
import {
  exportExcel,
  exportReportPrompt,
  exportProjectContent,
} from './utils/exports.js'
import AuthScreen from './components/AuthScreen.jsx'
import ProfileScreen from './components/ProfileScreen.jsx'
import Header from './components/Header.jsx'
import ProjectCard from './components/ProjectCard.jsx'
import TaskItem from './components/TaskItem.jsx'
const Dashboard = lazy(() => import('./components/Dashboard.jsx'))
const KanbanBoard = lazy(() => import('./components/KanbanBoard.jsx'))
const MeetingsView = lazy(() => import('./components/MeetingsView.jsx'))
const MeetingBoard = lazy(() => import('./components/MeetingBoard.jsx'))
import {
  Confirm,
  EditProject,
  EditTask,
  EditComment,
  EditDueDateModal,
  EditCreatedAtModal,
  MoveNoteModal,
  MoveCommentModal,
  TaskNotesModal,
} from './components/Modals.jsx'

function ScrollToTop() {
  const [visible, setVisible] = React.useState(false)
  React.useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  if (!visible) return null
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      title="Volver arriba"
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 200,
        width: 44,
        height: 44,
        borderRadius: '50%',
        background: 'var(--btn-primary)',
        border: 'none',
        color: 'var(--btn-primary-text)',
        fontSize: 20,
        cursor: 'pointer',
        boxShadow: '0 4px 16px #0006',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      ↑
    </button>
  )
}

function WorkspaceApp({ currentUser, setCurrentUser, doLogout }) {
  // ── 1. useState — todos primero ──────────────────────────────
  const [theme, setTheme] = useState(
    () => localStorage.getItem('ft_theme') || 'dark',
  )
  const [search, setSearch] = useState('')
  const [filterStatuses, setFilterStatuses] = useState([]) // [] = Todas; combinable: 'overdue' | 'warning' | 'ok' | 'done'
  const [filterProject, setFilterProject] = useState('all')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [showDone, setShowDone] = useState(true)
  const [viewMode, setViewMode] = useState('projects') // 'projects' | 'tasks' | 'bitacoras' | 'dashboard'
  const [expanded, setExpanded] = useState(null)
  const [expandedNotes, setExpandedNotes] = useState({})
  const [collapsedProjects, setCollapsedProjects] = useState({})
  const [expandingProjects, setExpandingProjects] = useState(false)
  const [newComment, setNewComment] = useState({})
  const [newProjNote, setNewProjNote] = useState({})
  const [newTaskFor, setNewTaskFor] = useState(null)
  const [newTask, setNewTask] = useState({
    title: '',
    responsible: '',
    due_date: '',
  })
  const [newProjOpen, setNewProjOpen] = useState(false)
  const [newProjName, setNewProjName] = useState('')
  const [newProjColor, setNewProjColor] = useState('#22c55e')
  const [archiveView, setArchiveView] = useState(false)
  const [membersModal, setMembersModal] = useState(null)
  const [restoreOpen, setRestoreOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileSubMenu, setMobileSubMenu] = useState(false)
  const [editProject, setEditProject] = useState(null)
  const [editTask, setEditTask] = useState(null)
  const [editComment, setEditComment] = useState(null)
  const [editNote, setEditNote] = useState(null)
  const [editDueDate, setEditDueDate] = useState(null) // { pId, task }
  const [editCreatedAt, setEditCreatedAt] = useState(null) // { type:'task'|'comment'|'note', pId, tId, item }
  const [confirm, setConfirm] = useState(null)
  const [moveNote, setMoveNote] = useState(null)
  const [moveComment, setMoveComment] = useState(null)
  const [notesTaskId, setNotesTaskId] = useState(null)
  const [highlightProjectId, setHighlightProjectId] = useState(null)
  const [meetingsArchiveView, setMeetingsArchiveView] = useState(false)
  const [selectedMeeting, setSelectedMeeting] = useState(null)

  // ── 2. Custom hooks ───────────────────────────────────────────
  const proj = useProjects()
  const meetings = useMeetings()
  const { toasts, toast, dismiss } = useToast()
  const errMsg = (e) =>
    isNetworkError(e) || e?.message === 'SIN_CONEXION'
      ? 'Sin conexión con la base de datos. La información no fue guardada.'
      : e?.message || 'Error al guardar. Intentá nuevamente.'

  // ── 3. Funciones síncronas ────────────────────────────────────
  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  // ── 4. useEffect ──────────────────────────────────────────────
  useEffect(() => {
    const hasUser = !!localStorage.getItem('ft_token')
    document.body.classList.toggle('dark', theme === 'dark' && hasUser)
    localStorage.setItem('ft_theme', theme)
  }, [theme])

  useEffect(() => {
    proj.loadProjects().then(() => {
      // Al cargar, colapsar todos los proyectos por defecto
      setCollapsedProjects((prev) => {
        const next = { ...prev }
        proj.projects.forEach((p) => {
          if (!(p.id in next)) next[p.id] = true
        })
        return next
      })
    })
    meetings.loadMeetings()
  }, [])

  useEffect(() => {
    if (search.trim() || viewMode === 'bitacoras')
      proj.ensureAllHistory().catch((e) => toast(errMsg(e), 'error'))
  }, [search, viewMode])
  const expandTask = (id) => {
    if (!id) {
      setExpanded(null)
      return
    }
    const task = proj.allTasks.find((t) => t.id === id)
    proj
      .ensureProjectHistory(task.projectId)
      .then(() => setExpanded(id))
      .catch((e) => toast(errMsg(e), 'error'))
  }
  const toggleProject = (id) => {
    if (collapsedProjects[id] === false) {
      setCollapsedProjects((c) => ({ ...c, [id]: true }))
      return
    }
    proj
      .ensureProjectHistory(id)
      .then(() => setCollapsedProjects((c) => ({ ...c, [id]: false })))
      .catch((e) => toast(errMsg(e), 'error'))
  }

  // Colapsar proyectos nuevos al cargar por primera vez
  useEffect(() => {
    if (proj.projects.length === 0) return
    setCollapsedProjects((prev) => {
      const next = { ...prev }
      let changed = false
      proj.projects.forEach((p) => {
        if (!(p.id in next)) {
          next[p.id] = true
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [proj.projects])

  const {
    filtered,
    filteredIgnoringSearch,
    filteredProjectNotes,
    matchingComments,
  } = useProjectFilters(proj, {
    search,
    filterStatuses,
    filterProject,
    showDone,
    filterDateFrom,
    filterDateTo,
  })

  const doneTasks = proj.allTasks.filter((t) => t.done)
  // Derivado en vivo de proj.allTasks (no una copia) para que el modal de notas
  // refleje altas/ediciones/bajas de notas sin tener que cerrarlo y reabrirlo
  const notesTask = notesTaskId
    ? proj.allTasks.find((t) => t.id === notesTaskId)
    : null

  const showConfirm = (msg, action, opts = {}) =>
    setConfirm({
      msg,
      action: () =>
        Promise.resolve()
          .then(action)
          .catch((e) => toast(errMsg(e), 'error')),
      ...opts,
    })

  // ── Filtros de estado combinables ───────────────────────────────
  const toggleStatusFilter = (key) => {
    if (key === null) {
      setFilterStatuses([])
      return
    }
    setFilterStatuses((prev) => {
      const has = prev.includes(key)
      if (key === 'done' && !has) setShowDone(true) // asegurar visibilidad al activar el filtro
      return has ? prev.filter((k) => k !== key) : [...prev, key]
    })
  }

  // ── Drill-down desde el Dashboard ───────────────────────────────
  const goToTasksFiltered = (status) => {
    if (status === 'done') setShowDone(true)
    setFilterStatuses(status === 'all' ? [] : [status])
    setViewMode('tasks')
  }

  const goToProject = (pId, taskId) => {
    proj.ensureProjectHistory(pId).catch((e) => toast(errMsg(e), 'error'))
    setFilterProject(String(pId))
    setViewMode('projects')
    setCollapsedProjects((c) => ({ ...c, [pId]: false }))
    if (taskId) {
      setExpanded(taskId)
      setTimeout(() => {
        const el = document.getElementById('task-' + taskId)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    } else {
      setTimeout(() => {
        const el = document.getElementById('project-' + pId)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }

  // ── Mover tarea entre días (Kanban semanal) ─────────────────────
  const onMoveTask = (task, due_date) => {
    proj
      .doSaveEditTask(task.projectId, task.id, {
        title: task.title,
        responsible: task.responsible || '',
        due_date,
      })
      .then(() => toast('Tarea movida'))
      .catch((e) => toast(errMsg(e), 'error'))
  }

  const kanbanAddTask = (projectId, taskData) => {
    return proj
      .doAddTask(projectId, taskData)
      .then(() => toast('Tarea agregada'))
      .catch((e) => {
        toast(errMsg(e), 'error')
        throw e
      })
  }

  // ── Llevar a un proyecto recién creado hasta la vista ────────────
  const scrollToNewProject = (pId) => {
    // Asegura que la tarjeta exista en el DOM: vista Proyectos, sin filtro de
    // proyecto/estado/búsqueda activo que la oculte (un proyecto recién creado
    // no tiene tareas, así que cualquiera de esos filtros lo dejaría afuera).
    setViewMode('projects')
    setFilterProject('all')
    setFilterStatuses([])
    setSearch('')
    setFilterDateFrom('')
    setFilterDateTo('')
    setArchiveView(false)
    // Se ejecuta después del auto-colapsado de proyectos nuevos para que
    // quede expandido y a mano, sin tener que buscarlo en la pantalla.
    setTimeout(() => {
      setCollapsedProjects((c) => ({ ...c, [pId]: false }))
      const el = document.getElementById('project-' + pId)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setHighlightProjectId(pId)
      setTimeout(
        () => setHighlightProjectId((h) => (h === pId ? null : h)),
        2200,
      ) // dura los 3 pulsos del CSS
    }, 150)
  }

  if (proj.loading)
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--splash-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 20,
          fontFamily: "'Plus Jakarta Sans',sans-serif",
        }}
      >
        <style>{`@keyframes flowbar{0%{transform:translateX(-100%)}100%{transform:translateX(400%)}}`}</style>
        <img
          src="/logo.png"
          alt="TaskLog"
          style={{
            width: 84,
            height: 84,
            borderRadius: 20,
            objectFit: 'cover',
            boxShadow: '0 4px 24px rgba(44,38,32,0.15)',
            marginBottom: 4,
          }}
        />
        <div
          className="app-logo-text"
          style={{
            fontSize: 26,
            color: 'var(--text-primary)',
            letterSpacing: '-0.5px',
          }}
        >
          TaskLog
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-muted)',
            fontFamily: "'DM Mono',monospace",
            letterSpacing: '1px',
          }}
        >
          Conectando con la base de datos...
        </div>
        <div
          style={{
            width: 140,
            height: 3,
            background: 'var(--bg-elevated)',
            borderRadius: 999,
            overflow: 'hidden',
            marginTop: 4,
          }}
        >
          <div
            style={{
              width: '40%',
              height: '100%',
              background: 'var(--accent)',
              borderRadius: 999,
              animation: 'flowbar 1.2s ease-in-out infinite',
            }}
          />
        </div>
      </div>
    )

  if (proj.error)
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--bg-base)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 16,
          color: 'var(--text-primary)',
          fontFamily: "'Plus Jakarta Sans',sans-serif",
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 36 }}>
          <Icon name="warning" size={15} />
        </div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Error de conexión</div>
        <div
          style={{
            color: 'var(--text-secondary)',
            maxWidth: 400,
            lineHeight: 1.6,
          }}
        >
          {proj.error}
        </div>
        <button
          onClick={proj.loadProjects}
          style={{
            background: 'var(--btn-primary)',
            border: 'none',
            color: 'var(--btn-primary-text)',
            padding: '10px 24px',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Reintentar
        </button>
      </div>
    )

  return (
    <div
      className="workspace"
      style={{
        minHeight: '100vh',
        background: 'var(--bg-base)',
        color: 'var(--text-primary)',
      }}
    >
      {proj.pending > 0 && (
        <div role="status" className="save-status">
          Actualizando…
        </div>
      )}
      {restoreOpen && (
        <RestoreBackup
          onClose={() => setRestoreOpen(false)}
          onRestored={() => {
            proj.loadProjects()
            meetings.loadMeetings()
            setArchiveView(false)
            setMeetingsArchiveView(false)
            setSelectedMeeting(null)
            setRestoreOpen(false)
            toast('Backup importado como copias nuevas')
          }}
        />
      )}
      {/* ── Modals ── */}
      {profileOpen && (
        <ProfileScreen
          user={currentUser}
          onSave={(user) => {
            setCurrentUser(user)
            setProfileOpen(false)
          }}
          onClose={() => setProfileOpen(false)}
        />
      )}

      {membersModal && (
        <MembersDialog
          project={proj.projects.find((p) => p.id === membersModal)}
          user={currentUser}
          onClose={() => setMembersModal(null)}
          onAdd={proj.doAddMember}
          onRemove={proj.doRemoveMember}
          onError={(e) => toast(errMsg(e), 'error')}
        />
      )}

      {confirm && (
        <Confirm
          msg={confirm.msg}
          onOk={() => {
            confirm.action()
            setConfirm(null)
          }}
          onCancel={() => setConfirm(null)}
          title={confirm.title}
          okLabel={confirm.okLabel}
          okColor={confirm.okColor}
        />
      )}
      {editProject && (
        <EditProject
          project={editProject}
          onSave={(name, color) => {
            proj
              .doSaveEditProject(editProject, name, color)
              .then(() => toast('Proyecto actualizado'))
              .catch((e) => toast(errMsg(e), 'error'))
            setEditProject(null)
          }}
          onClose={() => setEditProject(null)}
        />
      )}
      {editTask && (
        <EditTask
          task={editTask.task}
          projects={proj.projects}
          onSave={(form) => {
            proj
              .doSaveEditTask(editTask.pId, editTask.task.id, form)
              .then(() => toast('Tarea actualizada'))
              .catch((e) => toast(errMsg(e), 'error'))
            setEditTask(null)
          }}
          onClose={() => setEditTask(null)}
        />
      )}
      {notesTask && (
        <TaskNotesModal
          task={notesTask}
          onClose={() => setNotesTaskId(null)}
          onAddComment={(pId, tId, text) => {
            setNewComment((p) => ({ ...p, [tId]: '' }))
            proj
              .doAddComment(pId, tId, text)
              .then(() => toast('Nota agregada'))
              .catch((e) => {
                setNewComment((p) => ({ ...p, [tId]: text }))
                toast(errMsg(e), 'error')
              })
          }}
          newComment={newComment[notesTask.id]}
          onNewCommentChange={(tId, val) =>
            setNewComment((p) => ({ ...p, [tId]: val }))
          }
          onEditComment={(pId, tId, comment) =>
            setEditComment({ pId, tId, comment })
          }
          onDeleteComment={proj.doDeleteComment}
          onMoveComment={(comment, pId, tId) =>
            setMoveComment({ comment, pId, tId })
          }
          onConfirm={(msg, action, opts) => showConfirm(msg, action, opts)}
          onEditCreatedAt={(type, tId, item2) =>
            setEditCreatedAt({
              type,
              pId: notesTask.projectId,
              tId,
              item: item2,
            })
          }
        />
      )}
      {editComment && (
        <EditComment
          comment={editComment.comment}
          onSave={(data) => {
            proj
              .doSaveEditComment(
                editComment.pId,
                editComment.tId,
                editComment.comment.id,
                data,
              )
              .then(() => toast('Nota actualizada'))
              .catch((e) => toast(errMsg(e), 'error'))
            setEditComment(null)
          }}
          onClose={() => setEditComment(null)}
        />
      )}
      {editNote && (
        <EditComment
          comment={editNote.note}
          onSave={(data) => {
            proj
              .doSaveEditNote(editNote.pId, editNote.note.id, data)
              .then(() => toast('Nota actualizada'))
              .catch((e) => toast(errMsg(e), 'error'))
            setEditNote(null)
          }}
          onClose={() => setEditNote(null)}
        />
      )}
      {editDueDate && (
        <EditDueDateModal
          task={editDueDate.task}
          onSave={(due_date) => {
            proj
              .doSaveEditTask(editDueDate.pId, editDueDate.task.id, {
                title: editDueDate.task.title,
                responsible: editDueDate.task.responsible || '',
                due_date,
              })
              .then(() => toast('Fecha actualizada'))
              .catch((e) => toast(errMsg(e), 'error'))
            setEditDueDate(null)
          }}
          onClose={() => setEditDueDate(null)}
        />
      )}
      {editCreatedAt && editCreatedAt.type === 'task' && (
        <EditCreatedAtModal
          item={editCreatedAt.item}
          label={editCreatedAt.item.title}
          onSave={(d) => {
            proj
              .doSaveEditTask(editCreatedAt.pId, editCreatedAt.item.id, {
                title: editCreatedAt.item.title,
                responsible: editCreatedAt.item.responsible || '',
                due_date: editCreatedAt.item.due_date || '',
                created_at: d,
              })
              .then(() => toast('Fecha actualizada'))
              .catch((e) => toast(errMsg(e), 'error'))
            setEditCreatedAt(null)
          }}
          onClose={() => setEditCreatedAt(null)}
        />
      )}
      {editCreatedAt && editCreatedAt.type === 'comment' && (
        <EditCreatedAtModal
          item={editCreatedAt.item}
          label={editCreatedAt.item.text?.slice(0, 60)}
          onSave={(d) => {
            proj
              .doSaveEditComment(
                editCreatedAt.pId,
                editCreatedAt.tId,
                editCreatedAt.item.id,
                { text: editCreatedAt.item.text, created_at: d },
              )
              .then(() => toast('Fecha actualizada'))
              .catch((e) => toast(errMsg(e), 'error'))
            setEditCreatedAt(null)
          }}
          onClose={() => setEditCreatedAt(null)}
        />
      )}
      {editCreatedAt && editCreatedAt.type === 'note' && (
        <EditCreatedAtModal
          item={editCreatedAt.item}
          label={editCreatedAt.item.text?.slice(0, 60)}
          onSave={(d) => {
            proj
              .doSaveEditNote(editCreatedAt.pId, editCreatedAt.item.id, {
                text: editCreatedAt.item.text,
                created_at: d,
              })
              .then(() => toast('Fecha actualizada'))
              .catch((e) => toast(errMsg(e), 'error'))
            setEditCreatedAt(null)
          }}
          onClose={() => setEditCreatedAt(null)}
        />
      )}
      {moveNote && (
        <MoveNoteModal
          note={moveNote.note}
          tasks={proj.allTasks.filter((t) => !t.done)}
          onMove={(taskId) => {
            proj
              .doMoveNoteToTask(
                moveNote.note,
                moveNote.pId,
                taskId,
                proj.allTasks,
              )
              .then(() => toast('Nota movida a tarea'))
              .catch((e) => toast(errMsg(e), 'error'))
            setMoveNote(null)
          }}
          onClose={() => setMoveNote(null)}
        />
      )}
      {moveComment && (
        <MoveCommentModal
          comment={moveComment.comment}
          projects={proj.projects}
          currentProjectId={moveComment.pId}
          onMove={(projectId) => {
            proj
              .doMoveCommentToProject(
                moveComment.comment,
                moveComment.pId,
                moveComment.tId,
                projectId,
              )
              .then(() => toast('Nota movida al proyecto'))
              .catch((e) => toast(errMsg(e), 'error'))
            setMoveComment(null)
          }}
          onClose={() => setMoveComment(null)}
        />
      )}

      {/* ── Header ── */}
      <Header
        viewMode={viewMode}
        onNavigate={(id) => {
          setArchiveView(false)
          setViewMode(id)
          setSelectedMeeting(null)
        }}
        currentUser={currentUser}
        theme={theme}
        archiveView={archiveView}
        projects={proj.projects}
        onNewProject={() => setNewProjOpen(true)}
        onArchiveView={(v) =>
          setArchiveView(typeof v === 'function' ? v(archiveView) : v)
        }
        onExportExcel={() =>
          proj
            .ensureAllHistory()
            .then(exportExcel)
            .catch((e) => toast(errMsg(e), 'error'))
        }
        onExportReportPrompt={() =>
          proj
            .ensureAllHistory()
            .then(exportReportPrompt)
            .catch((e) => toast(errMsg(e), 'error'))
        }
        onBackup={() => proj.doBackup().catch((e) => toast(errMsg(e), 'error'))}
        onToggleTheme={toggleTheme}
        onProfile={() => setProfileOpen(true)}
        onRestore={() => setRestoreOpen(true)}
        onLogout={doLogout}
        userMenuOpen={userMenuOpen}
        setUserMenuOpen={setUserMenuOpen}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        mobileSubMenu={mobileSubMenu}
        setMobileSubMenu={setMobileSubMenu}
        loadArchived={proj.loadArchived}
      />

      {/* ── Archive view ── */}
      {archiveView ? (
        <main id="workspace-main" className="ft-main">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 20,
            }}
          >
            <span style={{ fontSize: 18, fontWeight: 700, color: '#fbbf24' }}>
              <Icon name="archive" size={15} /> Proyectos Archivados
            </span>
            {proj.archiveError && (
              <div role="alert">
                {proj.archiveError}{' '}
                <button onClick={proj.loadArchived}>Reintentar</button>
              </div>
            )}
            {proj.loadingArchived && (
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Cargando...
              </span>
            )}
            {!proj.loadingArchived && (
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {proj.archivedProjects.length} proyecto
                {proj.archivedProjects.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {!proj.loadingArchived && proj.archivedProjects.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                color: 'var(--text-faint)',
                fontSize: 14,
                padding: 40,
              }}
            >
              No hay proyectos archivados.
            </div>
          )}
          {proj.archivedProjects.map((project) => (
            <div
              key={project.id}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-soft)',
                borderRadius: 14,
                marginBottom: 12,
                overflow: 'hidden',
                opacity: 0.85,
              }}
            >
              <div
                style={{
                  borderLeft: `4px solid ${project.color}`,
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: `linear-gradient(90deg,${project.color}11,transparent)`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      background: project.color,
                    }}
                  />
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 15,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {project.name}
                  </span>
                  <span
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-soft)',
                      borderRadius: 20,
                      padding: '1px 9px',
                      fontSize: 11,
                      color: 'var(--text-faint)',
                    }}
                  >
                    {project.tasks.length} tarea
                    {project.tasks.length !== 1 ? 's' : ''} ·{' '}
                    {project.notes?.length || 0} nota
                    {(project.notes?.length || 0) !== 1 ? 's' : ''}
                  </span>
                  <span
                    style={{
                      background: '#451a03',
                      border: '1px solid #92400e',
                      borderRadius: 20,
                      padding: '1px 9px',
                      fontSize: 11,
                      color: '#fbbf24',
                    }}
                  >
                    <Icon name="archive" size={15} /> Archivado
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 7 }}>
                  <button
                    onClick={() =>
                      showConfirm(
                        `¿Restaurar "${project.name}" a la pantalla principal?`,
                        () => proj.doUnarchiveProject(project.id),
                        {
                          title: '↩ Confirmar restauración',
                          okLabel: 'Restaurar',
                          okColor: '#059669',
                        },
                      )
                    }
                    style={{
                      background: '#065f46',
                      border: '1px solid #059669',
                      color: '#34d399',
                      padding: '6px 14px',
                      borderRadius: 7,
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    ↩ Restaurar
                  </button>
                  <button
                    onClick={() =>
                      showConfirm(
                        `¿Eliminar "${project.name}" y TODAS sus tareas y notas? Esta acción no se puede deshacer.`,
                        () =>
                          proj
                            .doDeleteProject(project.id)
                            .then(() => toast('Proyecto eliminado'))
                            .catch((e) => toast(errMsg(e), 'error')),
                      )
                    }
                    style={{
                      ...S.iconBtn,
                      borderColor: '#dc262633',
                      color: '#ef4444',
                    }}
                    title="Eliminar permanentemente"
                  >
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              </div>
              <div
                style={{
                  padding: '8px 16px',
                  fontSize: 12,
                  color: 'var(--text-faint)',
                  display: 'flex',
                  gap: 16,
                  borderTop: '1px solid var(--border)',
                }}
              >
                <span>
                  <Icon name="tasks" size={15} />{' '}
                  {project.tasks.filter((t) => !t.done).length} pendiente
                  {project.tasks.filter((t) => !t.done).length !== 1 ? 's' : ''}
                </span>
                <span>
                  <Icon name="check" size={15} />{' '}
                  {project.tasks.filter((t) => t.done).length} completada
                  {project.tasks.filter((t) => t.done).length !== 1 ? 's' : ''}
                </span>
                <span>
                  <Icon name="note" size={15} /> {project.notes?.length || 0}{' '}
                  nota{(project.notes?.length || 0) !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          ))}
        </main>
      ) : (
        <main id="workspace-main" className="ft-main">
          <div className="page-heading">
            <div>
              <span className="eyebrow">TU ESPACIO, EN ORDEN</span>
              <h1>
                {
                  {
                    projects: 'Proyectos',
                    tasks: 'Tus tareas',
                    bitacoras: 'Bitácoras',
                    kanban: 'Tu semana',
                    meetings: 'Reuniones',
                    dashboard: 'Resumen de tu espacio',
                  }[viewMode]
                }
              </h1>
              <p>
                {
                  {
                    projects: 'Grandes ideas, próximos pasos claros.',
                    tasks: 'Lo importante, a la vista. Una tarea a la vez.',
                    bitacoras:
                      'Decisiones, notas y contexto para seguir avanzando.',
                    kanban: 'Dale espacio a tus prioridades.',
                    meetings: 'Conversaciones que se convierten en avances.',
                    dashboard: 'Una mirada clara a cómo viene tu trabajo.',
                  }[viewMode]
                }
              </p>
            </div>
            {viewMode !== 'meetings' && (
              <button
                className="button button-primary page-create"
                onClick={() => {
                  setNewProjOpen(true)
                  setArchiveView(false)
                  setViewMode('projects')
                }}
              >
                <Icon name="plus" />
                Nuevo proyecto
              </button>
            )}
          </div>
          {viewMode !== 'meetings' && (
            <WorkspaceToolbar
              {...{
                search,
                setSearch,
                filterProject,
                setFilterProject,
                projects: proj.projects,
                showDone,
                setShowDone,
                filterDateFrom,
                setFilterDateFrom,
                filterDateTo,
                setFilterDateTo,
                viewMode,
              }}
            />
          )}
          {!['dashboard', 'meetings', 'bitacoras'].includes(viewMode) && (
            <div className="overview-strip" aria-label="Resumen de tareas">
              {[
                {
                  label: 'Todas las tareas',
                  val: proj.allTasks.length,
                  filter: null,
                  icon: 'tasks',
                  tone: 'neutral',
                },
                {
                  label: 'Por vencer',
                  val: proj.allTasks.filter(
                    (t) => getStatus(t.due_date, t.done) === 'warning',
                  ).length,
                  filter: 'warning',
                  icon: 'clock',
                  tone: 'warning',
                },
                {
                  label: 'Vencidas',
                  val: proj.allTasks.filter(
                    (t) => getStatus(t.due_date, t.done) === 'overdue',
                  ).length,
                  filter: 'overdue',
                  icon: 'warning',
                  tone: 'overdue',
                },
                {
                  label: 'Completadas',
                  val: doneTasks.length,
                  filter: 'done',
                  icon: 'check',
                  tone: 'done',
                },
              ].map((stat) => (
                <button
                  key={stat.label}
                  className={`overview-card ${stat.tone}`}
                  aria-pressed={
                    stat.filter === null
                      ? filterStatuses.length === 0
                      : filterStatuses.includes(stat.filter)
                  }
                  onClick={() => toggleStatusFilter(stat.filter)}
                >
                  <Icon name={stat.icon} />
                  <span className="stat-copy">
                    <strong>{stat.val}</strong>
                    {stat.label}
                  </span>
                </button>
              ))}
            </div>
          )}
          {viewMode === 'projects' &&
            proj.projects.length === 0 &&
            !newProjOpen && (
              <div className="empty-state">
                <span className="empty-icon">
                  <Icon name="folder" size={32} />
                </span>
                <h2>Todo empieza con un proyecto</h2>
                <p>
                  Creá tu primer proyecto, sumá las tareas y dale forma a lo que
                  viene.
                </p>
                <button
                  className="button button-primary"
                  onClick={() => setNewProjOpen(true)}
                >
                  <Icon name="plus" />
                  Crear mi primer proyecto
                </button>
              </div>
            )}
          {/* Colapsar / Expandir todos */}
          {viewMode === 'projects' && proj.sortedProjects.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginBottom: 10,
                }}
              >
                <button
                  disabled={expandingProjects}
                  aria-busy={expandingProjects}
                  onClick={async () => {
                    if (expandingProjects) return
                    const projects = proj.sortedProjects
                    const allCollapsed = projects.every(p => collapsedProjects[p.id])
                    if (!allCollapsed) {
                      setCollapsedProjects(prev => ({...prev, ...Object.fromEntries(projects.map(p => [p.id, true]))}))
                      return
                    }
                    setExpandingProjects(true)
                    try {
                      await proj.ensureAllHistory()
                      setCollapsedProjects(prev => ({...prev, ...Object.fromEntries(projects.map(p => [p.id, false]))}))
                    } catch (e) {
                      toast(errMsg(e), 'error')
                    } finally {
                      setExpandingProjects(false)
                    }
                  }}
                  style={{
                    ...S.btnSecondary,
                    padding: '5px 12px',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  {expandingProjects ? 'Cargando…' : proj.sortedProjects.every((p) => collapsedProjects[p.id])
                    ? '▼ Expandir todos'
                    : '▲ Colapsar todos'}
                </button>
              </div>
            )}

          {/* Nuevo proyecto */}
          {newProjOpen && (
            <div
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-soft)',
                borderRadius: 12,
                padding: 14,
                marginBottom: 16,
                display: 'flex',
                gap: 10,
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <input
                placeholder="Nombre del proyecto..."
                value={newProjName}
                onChange={(e) => setNewProjName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newProjName.trim()) {
                    proj
                      .doAddProject(newProjName, newProjColor)
                      .then((project) => {
                        setNewProjName('')
                        setNewProjOpen(false)
                        toast('Proyecto creado')
                        scrollToNewProject(project.id)
                      })
                      .catch((e) => toast(errMsg(e), 'error'))
                  }
                }}
                style={{ ...S.input, flex: 1 }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {COLORS.map((c) => (
                  <button
                    type="button"
                    aria-label={`Color ${c}`}
                    aria-pressed={newProjColor === c}
                    key={c}
                    onClick={() => setNewProjColor(c)}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: c,
                      cursor: 'pointer',
                      border:
                        newProjColor === c
                          ? '3px solid white'
                          : '3px solid transparent',
                      boxSizing: 'border-box',
                    }}
                  />
                ))}
              </div>
              <button
                onClick={() => {
                  proj
                    .doAddProject(newProjName, newProjColor)
                    .then((project) => {
                      setNewProjName('')
                      setNewProjOpen(false)
                      toast('Proyecto creado')
                      scrollToNewProject(project.id)
                    })
                    .catch((e) => toast(errMsg(e), 'error'))
                }}
                style={S.btnPrimary}
              >
                Crear
              </button>
              <button
                onClick={() => setNewProjOpen(false)}
                style={S.btnSecondary}
              >
                Cancelar
              </button>
            </div>
          )}

          {/* Resultados búsqueda en bitácoras */}
          {search.trim() &&
            (filteredProjectNotes.length > 0 ||
              Object.keys(matchingComments).length > 0) && (
              <div
                style={{
                  background: 'var(--bg-hover)',
                  border: '1px solid #4338ca44',
                  borderRadius: 12,
                  marginBottom: 18,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border)',
                    background: '#1e1b4b44',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span
                    style={{ fontSize: 13, fontWeight: 700, color: '#818cf8' }}
                  >
                    <Icon name="search" size={15} /> Resultados en bitácoras
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: '#4338ca',
                      background: '#1e1b4b',
                      border: '1px solid #4338ca',
                      borderRadius: 20,
                      padding: '1px 8px',
                    }}
                  >
                    {filteredProjectNotes.length +
                      Object.values(matchingComments).flat().length}{' '}
                    resultado
                    {filteredProjectNotes.length +
                      Object.values(matchingComments).flat().length !==
                    1
                      ? 's'
                      : ''}
                  </span>
                </div>
                {filteredProjectNotes.map((note) => (
                  <div
                    key={`pnote-${note.id}`}
                    style={{
                      padding: '10px 16px',
                      borderBottom: '1px solid #1e293b22',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                    }}
                  >
                    <div style={{ flexShrink: 0, marginTop: 2 }}>
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: note.projectColor,
                        }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          marginBottom: 3,
                          display: 'flex',
                          gap: 8,
                          alignItems: 'center',
                        }}
                      >
                        <span
                          style={{ color: 'var(--text-secondary)', fontWeight: 600 }}
                        >
                          <Icon name="folder" size={15} /> {note.projectName}
                        </span>
                        <span>·</span>
                        <span
                          style={{
                            background: '#1e1b4b',
                            color: '#818cf8',
                            padding: '1px 7px',
                            borderRadius: 10,
                            fontSize: 10,
                          }}
                        >
                          Bitácora de proyecto
                        </span>
                        <span>·</span>
                        <span>{note.author || '—'}</span>
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: 'var(--text-content)',
                          lineHeight: 1.5,
                        }}
                      >
                        {note.text}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setCollapsedProjects((c) => ({
                          ...c,
                          [note.projectId]: false,
                        }))
                        setExpandedNotes((n) => ({
                          ...n,
                          [note.projectId]: true,
                        }))
                        setTimeout(() => {
                          const el = document.getElementById(
                            'project-' + note.projectId,
                          )
                          if (el)
                            el.scrollIntoView({
                              behavior: 'smooth',
                              block: 'start',
                            })
                        }, 100)
                      }}
                      style={{
                        ...S.btnSecondary,
                        padding: '4px 10px',
                        fontSize: 11,
                        flexShrink: 0,
                      }}
                    >
                      Ver proyecto ↓
                    </button>
                  </div>
                ))}
                {Object.entries(matchingComments).map(([taskId, comments]) => {
                  const task = proj.allTasks.find(
                    (t) => t.id === parseInt(taskId),
                  )
                  if (!task) return null
                  return comments.map((c) => (
                    <div
                      key={`tcomm-${c.id}`}
                      style={{
                        padding: '10px 16px',
                        borderBottom: '1px solid #1e293b22',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12,
                      }}
                    >
                      <div style={{ flexShrink: 0, marginTop: 2 }}>
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: task.projectColor,
                          }}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--text-muted)',
                            marginBottom: 3,
                            display: 'flex',
                            gap: 8,
                            alignItems: 'center',
                            flexWrap: 'wrap',
                          }}
                        >
                          <span
                            style={{
                              color: 'var(--text-secondary)',
                              fontWeight: 600,
                            }}
                          >
                            <Icon name="folder" size={15} /> {task.projectName}
                          </span>
                          <span>›</span>
                          <span
                            style={{
                              color: 'var(--text-secondary)',
                              fontWeight: 600,
                            }}
                          >
                            <Icon name="tasks" size={15} /> {task.title}
                          </span>
                          <span>·</span>
                          <span
                            style={{
                              background: '#0f2a1e',
                              color: '#4ade80',
                              padding: '1px 7px',
                              borderRadius: 10,
                              fontSize: 10,
                            }}
                          >
                            Bitácora de tarea
                          </span>
                          <span>·</span>
                          <span>{c.author || '—'}</span>
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            color: 'var(--text-content)',
                            lineHeight: 1.5,
                          }}
                        >
                          {c.text}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setCollapsedProjects((c) => ({
                            ...c,
                            [task.projectId]: false,
                          }))
                          setExpanded(parseInt(taskId))
                          setTimeout(() => {
                            const el = document.getElementById('task-' + taskId)
                            if (el)
                              el.scrollIntoView({
                                behavior: 'smooth',
                                block: 'center',
                              })
                          }, 100)
                        }}
                        style={{
                          ...S.btnSecondary,
                          padding: '4px 10px',
                          fontSize: 11,
                          flexShrink: 0,
                        }}
                      >
                        Ver tarea ↓
                      </button>
                    </div>
                  ))
                })}
              </div>
            )}

          {/* Proyectos */}
          {/* Vista Tareas — interactiva: agregar notas, editar y completar sin perder el filtro */}
          {viewMode === 'tasks' &&
            (() => {
              const tasksList = [...filtered].sort((a, b) => {
                const stA = getStatus(a.due_date, a.done),
                  stB = getStatus(b.due_date, b.done)
                const order = { overdue: 0, warning: 1, ok: 2, done: 3 }
                if (order[stA] !== order[stB]) return order[stA] - order[stB]
                if (a.due_date && b.due_date)
                  return a.due_date.localeCompare(b.due_date)
                if (a.due_date) return -1
                if (b.due_date) return 1
                return 0
              })
              return (
                <div
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 14,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border)',
                      background: 'var(--bg-elevated)',
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    <Icon name="note" size={15} /> Listado de tareas —{' '}
                    {tasksList.length} resultado
                    {tasksList.length !== 1 ? 's' : ''}
                  </div>
                  {tasksList.length === 0 && (
                    <div
                      style={{
                        padding: 24,
                        textAlign: 'center',
                        color: 'var(--text-faint)',
                        fontSize: 13,
                      }}
                    >
                      Sin tareas.
                    </div>
                  )}
                  {tasksList.map((t) => (
                    <TaskItem
                      key={t.id}
                      task={t}
                      expanded={expanded}
                      onToggle={(id) =>
                        proj
                          .doToggle(id)
                          .catch((e) => toast(errMsg(e), 'error'))
                      }
                      onExpand={expandTask}
                      onEdit={(task) => setEditTask({ pId: t.projectId, task })}
                      onDelete={proj.doDeleteTask}
                      onEditComment={(pId, tId, comment) =>
                        setEditComment({ pId, tId, comment })
                      }
                      onDeleteComment={proj.doDeleteComment}
                      onMoveComment={(comment, pId, tId) =>
                        setMoveComment({ comment, pId, tId })
                      }
                      onAddComment={(pId, tId, text) => {
                        setNewComment((p) => ({ ...p, [tId]: '' }))
                        proj
                          .doAddComment(pId, tId, text)
                          .then(() => toast('Nota agregada'))
                          .catch((e) => {
                            setNewComment((p) => ({ ...p, [tId]: text }))
                            toast(errMsg(e), 'error')
                          })
                      }}
                      newComment={newComment[t.id]}
                      onNewCommentChange={(tId, val) =>
                        setNewComment((p) => ({ ...p, [tId]: val }))
                      }
                      onConfirm={(msg, action, opts) =>
                        showConfirm(msg, action, opts)
                      }
                      onEditDueDate={(task) =>
                        setEditDueDate({ pId: t.projectId, task })
                      }
                      onEditCreatedAt={(type, tId, item2) =>
                        setEditCreatedAt({
                          type,
                          pId: t.projectId,
                          tId,
                          item: item2,
                        })
                      }
                      showProject
                    />
                  ))}
                </div>
              )
            })()}

          {/* Vista Bitácoras */}
          {viewMode === 'bitacoras' &&
            (() => {
              const allNotes = [
                ...proj.projects
                  .filter(
                    (p) =>
                      filterProject === 'all' ||
                      p.id === parseInt(filterProject),
                  )
                  .flatMap((p) =>
                    (p.notes || []).map((n) => ({
                      ...n,
                      _kind: 'proyecto',
                      projectName: p.name,
                      projectColor: p.color,
                      taskTitle: null,
                    })),
                  ),
                ...proj.allTasks
                  .filter(
                    (t) =>
                      filterProject === 'all' ||
                      t.projectId === parseInt(filterProject),
                  )
                  .flatMap((t) =>
                    t.comments.map((c) => ({
                      ...c,
                      _kind: 'tarea',
                      projectName: t.projectName,
                      projectColor: t.projectColor,
                      taskTitle: t.title,
                    })),
                  ),
              ]
                .filter(
                  (n) =>
                    !search.trim() ||
                    n.text.toLowerCase().includes(search.toLowerCase()) ||
                    n.projectName
                      .toLowerCase()
                      .includes(search.toLowerCase()) ||
                    (n.taskTitle || '')
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                )
                .sort((a, b) =>
                  (b.created_at || '') > (a.created_at || '') ? 1 : -1,
                )
              return (
                <div
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 14,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border)',
                      background: 'var(--bg-elevated)',
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    <Icon name="message" size={15} /> Listado de bitácoras —{' '}
                    {allNotes.length} resultado
                    {allNotes.length !== 1 ? 's' : ''}
                  </div>
                  {allNotes.length === 0 && (
                    <div
                      style={{
                        padding: 24,
                        textAlign: 'center',
                        color: 'var(--text-faint)',
                        fontSize: 13,
                      }}
                    >
                      Sin bitácoras.
                    </div>
                  )}
                  {allNotes.map((n, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '10px 16px',
                        borderBottom: '1px solid var(--border)',
                        borderLeft: `3px solid ${n.projectColor}`,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--text-muted)',
                            marginBottom: 4,
                            display: 'flex',
                            gap: 8,
                            flexWrap: 'wrap',
                            alignItems: 'center',
                          }}
                        >
                          <span
                            style={{ color: 'var(--text-secondary)', fontWeight: 600 }}
                          >
                            <Icon name="folder" size={15} /> {n.projectName}
                          </span>
                          {n.taskTitle && (
                            <>
                              <span>›</span>
                              <span
                                style={{
                                  color: 'var(--text-secondary)',
                                  fontWeight: 600,
                                }}
                              >
                                <Icon name="tasks" size={15} /> {n.taskTitle}
                              </span>
                            </>
                          )}
                          <span
                            style={{
                              background:
                                n._kind === 'tarea' ? '#0f2a1e' : '#1e1b4b',
                              color:
                                n._kind === 'tarea' ? '#4ade80' : '#818cf8',
                              padding: '1px 7px',
                              borderRadius: 10,
                              fontSize: 10,
                            }}
                          >
                            {n._kind === 'tarea'
                              ? 'Bitácora de tarea'
                              : 'Bitácora de proyecto'}
                          </span>
                          <span>·</span>
                          <span>{n.author || '—'}</span>
                          <span>·</span>
                          <span>{fmtDate(n.created_at)}</span>
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            color: 'var(--text-content)',
                            lineHeight: 1.5,
                          }}
                        >
                          {n.text}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}

          {/* Kanban semanal */}
          {viewMode === 'kanban' && (
            <KanbanBoard
              tasks={filtered}
              projects={proj.projects}
              onToggleTask={(id) =>
                proj.doToggle(id).catch((e) => toast(errMsg(e), 'error'))
              }
              onEditTask={(task) => setEditTask({ pId: task.projectId, task })}
              onDeleteTask={proj.doDeleteTask}
              onMoveTask={onMoveTask}
              onConfirm={(msg, action, opts) => showConfirm(msg, action, opts)}
              onOpenNotes={(task) =>
                proj
                  .ensureProjectHistory(task.projectId)
                  .then(() => setNotesTaskId(task.id))
                  .catch((e) => toast(errMsg(e), 'error'))
              }
              onAddTask={kanbanAddTask}
            />
          )}

          {/* Reuniones */}
          {viewMode === 'meetings' &&
            (selectedMeeting ? (
              <MeetingBoard
                meeting={selectedMeeting}
                onBack={() => {
                  setSelectedMeeting(null)
                  meetings.loadMeetings()
                }}
              />
            ) : (
              <MeetingsView
                meetings={meetings.meetings}
                archivedView={meetingsArchiveView}
                archivedMeetings={meetings.archivedMeetings}
                loadingArchived={meetings.loadingArchived}
                loading={meetings.loading}
                error={
                  meetingsArchiveView ? meetings.archiveError : meetings.error
                }
                onRetry={meetings.loadMeetings}
                onOpenMeeting={(m) => setSelectedMeeting(m)}
                onToggleArchivedView={() => {
                  if (!meetingsArchiveView) meetings.loadArchivedMeetings()
                  setMeetingsArchiveView((v) => !v)
                }}
                onAddMeeting={(name, color) =>
                  meetings
                    .doAddMeeting(name, color)
                    .then(() => toast('Reunión creada'))
                }
                onEditMeeting={(m) => {
                  const current =
                    meetings.meetings.find((x) => x.id === m.id) ||
                    meetings.archivedMeetings.find((x) => x.id === m.id)
                  meetings
                    .doSaveEditMeeting(current, m.name, m.color)
                    .then(() => toast('Reunión actualizada'))
                    .catch((e) => toast(errMsg(e), 'error'))
                }}
                onArchiveMeeting={(mId) =>
                  meetings
                    .doArchiveMeeting(mId)
                    .then(() => toast('Reunión cerrada', 'warning'))
                    .catch((e) => toast(errMsg(e), 'error'))
                }
                onUnarchiveMeeting={(mId) =>
                  meetings
                    .doUnarchiveMeeting(mId)
                    .then(() => toast('Reunión reabierta'))
                    .catch((e) => toast(errMsg(e), 'error'))
                }
                onDeleteMeeting={(mId) =>
                  meetings
                    .doDeleteMeeting(mId)
                    .then(() => toast('Reunión eliminada'))
                    .catch((e) => toast(errMsg(e), 'error'))
                }
                onConfirm={(msg, action, opts) =>
                  showConfirm(msg, action, opts)
                }
              />
            ))}

          {/* Dashboard */}
          {viewMode === 'dashboard' && (
            <Dashboard
              projects={proj.projects}
              filterProject={filterProject}
              onSetFilterProject={setFilterProject}
              onDrillTasks={goToTasksFiltered}
              onDrillProject={goToProject}
            />
          )}

          {/* Proyectos */}
          {viewMode === 'projects' &&
            proj.sortedProjects.map((project) => {
              if (
                filterProject !== 'all' &&
                project.id !== parseInt(filterProject)
              )
                return null
              // Si el propio nombre del proyecto matchea la búsqueda, se muestra
              // completo (todas sus tareas/notas); si no, se acota a lo que matchea.
              const q = search.trim().toLowerCase()
              const projectNameMatches =
                !!q && project.name.toLowerCase().includes(q)
              const ptasks = (
                projectNameMatches ? filteredIgnoringSearch : filtered
              ).filter((t) => t.projectId === project.id)
              if (filterStatuses.length > 0 && ptasks.length === 0) return null
              // Filtrar notas del proyecto por fecha de registro y, si el nombre
              // del proyecto no matcheó, también por texto de búsqueda
              const filteredNotes = (project.notes || []).filter((n) => {
                const d = String(n.created_at || '').slice(0, 10)
                if (filterDateFrom && d < filterDateFrom) return false
                if (filterDateTo && d > filterDateTo) return false
                if (
                  q &&
                  !projectNameMatches &&
                  !n.text.toLowerCase().includes(q) &&
                  !(n.author || '').toLowerCase().includes(q)
                )
                  return false
                return true
              })
              // Filtrar bitácoras de tareas por fecha de registro
              const projectWithFilteredNotes = {
                ...project,
                notes: filteredNotes,
                tasks: project.tasks.map((t) => ({
                  ...t,
                  comments: t.comments.filter((c) => {
                    const d = String(c.created_at || '').slice(0, 10)
                    if (filterDateFrom && d < filterDateFrom) return false
                    if (filterDateTo && d > filterDateTo) return false
                    return true
                  }),
                })),
              }
              if (
                !projectNameMatches &&
                q &&
                ptasks.length === 0 &&
                filteredNotes.length === 0
              )
                return null
              return (
                <ProjectCard
                  key={project.id}
                  project={projectWithFilteredNotes}
                  filteredTasks={ptasks}
                  highlighted={project.id === highlightProjectId}
                  collapsed={collapsedProjects[project.id]}
                  onToggleCollapse={toggleProject}
                  onExportProject={(p) =>
                    proj
                      .ensureProjectHistory(p.id)
                      .then(exportProjectContent)
                      .catch((e) => toast(errMsg(e), 'error'))
                  }
                  expanded={expanded}
                  onExpand={expandTask}
                  onToggleTask={(id) =>
                    proj.doToggle(id).catch((e) => toast(errMsg(e), 'error'))
                  }
                  showNotes={filterStatuses.length === 0}
                  newTaskFor={newTaskFor}
                  onOpenNewTask={(id) => {
                    setNewTaskFor(id)
                    if (id)
                      setNewTask({ title: '', responsible: '', due_date: '' })
                  }}
                  newTask={newTask}
                  onNewTaskChange={setNewTask}
                  onAddTask={(pId) => {
                    const { due_day, due_month, due_year, ...rest } = newTask
                    const builtDue =
                      due_day && due_month
                        ? (due_year || String(new Date().getFullYear())) +
                          '-' +
                          String(due_month).padStart(2, '0') +
                          '-' +
                          String(due_day).padStart(2, '0')
                        : ''
                    const taskData = { ...rest, due_date: builtDue }
                    proj
                      .doAddTask(pId, taskData)
                      .then(() => {
                        setNewTask({
                          title: '',
                          responsible: '',
                          due_date: '',
                          due_day: '',
                          due_month: '',
                          due_year: '',
                        })
                        setNewTaskFor(null)
                        toast('Tarea agregada')
                      })
                      .catch((e) => toast(errMsg(e), 'error'))
                  }}
                  newProjNote={newProjNote}
                  onNewProjNoteChange={(key, val) =>
                    setNewProjNote((n) => ({ ...n, [key]: val }))
                  }
                  onAddProjectNote={(pId) => {
                    proj
                      .doAddProjectNote(pId, newProjNote[pId] || '')
                      .then(() => {
                        setNewProjNote((n) => ({
                          ...n,
                          [pId]: '',
                          [pId + '_open']: false,
                        }))
                        toast('Nota agregada')
                      })
                      .catch((e) => toast(errMsg(e), 'error'))
                  }}
                  onEditProject={setEditProject}
                  onDeleteProject={(pId) =>
                    proj
                      .doDeleteProject(pId)
                      .then(() => toast('Proyecto eliminado'))
                      .catch((e) => toast(errMsg(e), 'error'))
                  }
                  onArchiveProject={(pId) =>
                    proj
                      .doArchiveProject(pId)
                      .then(() => toast('Proyecto archivado', 'warning'))
                      .catch((e) => toast(errMsg(e), 'error'))
                  }
                  onMembersModal={(id) => {
                    setMembersModal(id)
                  }}
                  onEditTask={(pId, task) => setEditTask({ pId, task })}
                  onEditDueDate={(pId, task) => setEditDueDate({ pId, task })}
                  onEditCreatedAt={(type, pId, tId, item) =>
                    setEditCreatedAt({ type, pId, tId, item })
                  }
                  onDeleteTask={proj.doDeleteTask}
                  onEditComment={(pId, tId, comment) =>
                    setEditComment({ pId, tId, comment })
                  }
                  onDeleteComment={proj.doDeleteComment}
                  onMoveComment={(comment, pId, tId) =>
                    setMoveComment({ comment, pId, tId })
                  }
                  onMoveNote={(note, pId) => setMoveNote({ note, pId })}
                  onAddComment={(pId, tId, text) => {
                    setNewComment((p) => ({ ...p, [tId]: '' }))
                    proj
                      .doAddComment(pId, tId, text)
                      .then(() => toast('Nota agregada'))
                      .catch((e) => {
                        setNewComment((p) => ({ ...p, [tId]: text }))
                        toast(errMsg(e), 'error')
                      })
                  }}
                  newComment={newComment}
                  onNewCommentChange={(tId, val) =>
                    setNewComment((p) => ({ ...p, [tId]: val }))
                  }
                  onEditNote={(pId, note) => setEditNote({ pId, note })}
                  onDeleteNote={proj.doDeleteProjectNote}
                  onConfirm={(msg, action, opts) =>
                    showConfirm(msg, action, opts)
                  }
                />
              )
            })}

          {/* Completadas — solo en vista proyectos */}
        </main>
      )}
      <Toast toasts={toasts} onDismiss={dismiss} />
      <ScrollToTop />
    </div>
  )
}

export default function App() {
  const session = useSession()
  if (session.loading)
    return (
      <div className="session-screen" role="status">
        Verificando sesión…
      </div>
    )
  if (session.error)
    return (
      <div className="session-screen" role="alert">
        No se pudo verificar la sesión.{' '}
        <button onClick={session.verify}>Reintentar</button>
        <button onClick={session.logout}>Volver al inicio</button>
      </div>
    )
  if (!session.user) return <AuthScreen onAuth={session.login} />
  return (
    <Suspense
      fallback={
        <div className="session-screen" role="status">
          Cargando vista…
        </div>
      }
    >
      <WorkspaceApp
        key={`${session.user.id}:${localStorage.getItem('ft_token')}`}
        currentUser={session.user}
        setCurrentUser={session.login}
        doLogout={session.logout}
      />
    </Suspense>
  )
}
