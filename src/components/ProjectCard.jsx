import Icon from './Icon.jsx'
import ActionMenu from './ActionMenu.jsx'
import { activateOnKeyboard } from '../utils/accessibility.js'
import { S, STATUS, getStatus, fmtDate, PRIORITY } from '../utils/helpers.js'
import { exportProjectContent } from '../utils/exports.js'
import TaskItem from './TaskItem.jsx'

export default function ProjectCard({
  onExportProject,
  project,
  filteredTasks,
  collapsed,
  onToggleCollapse,
  expanded,
  onExpand,
  onToggleTask,
  newTaskFor,
  onOpenNewTask,
  newTask,
  onNewTaskChange,
  onAddTask,
  newProjNote,
  onNewProjNoteChange,
  onAddProjectNote,
  onEditProject,
  onDeleteProject,
  onArchiveProject,
  onMembersModal,
  onEditTask,
  onDeleteTask,
  onEditComment,
  onDeleteComment,
  onMoveComment,
  onMoveNote,
  onAddComment,
  newComment,
  onNewCommentChange,
  onEditNote,
  onDeleteNote,
  onConfirm,
  showNotes,
  onEditDueDate,
  onEditCreatedAt,
  highlighted,
  hideMembers,
}) {
  const overdueCount = project.tasks.filter(
    (t) => getStatus(t.due_date, t.done) === 'overdue',
  ).length
  const warningCount = project.tasks.filter(
    (t) => getStatus(t.due_date, t.done) === 'warning',
  ).length
  const hasOverdue = overdueCount > 0
  const hasWarning = warningCount > 0
  const isCollapsed = collapsed || false
  const noteOpen = newProjNote[project.id + '_open']
  const alertStatus = hasOverdue ? 'overdue' : hasWarning ? 'warning' : undefined

  // Tareas y notas mezcladas, ordenadas únicamente por fecha de registro
  // (más nueva primero) sin agrupar por estado — el color de cada tarjeta
  // ya indica si está vencida/por vencer.
  const taskItems = filteredTasks.map((t) => ({
    ...t,
    _type: 'task',
    projectId: t.projectId ?? project.id,
  }))
  const noteItems = showNotes
    ? [...(project.notes || [])].map((n) => ({
        ...n,
        _type: 'note',
        projectId: project.id,
      }))
    : []
  const mixedItems = [...taskItems, ...noteItems].sort((a, b) =>
    (b.created_at || '') < (a.created_at || '') ? -1 : 1,
  )

  return (
    <div
      id={`project-${project.id}`}
      className={`project-card neu-card${highlighted ? ' ft-project-highlight' : ''}`}
      data-alert={alertStatus}
      style={{ '--project-color': project.color }}
    >
      <div className="ft-proj-header">
        <div className="project-identity">
          <span className="project-mark">
            <Icon name="folder" size={21} />
          </span>
          <div>
            <div className="project-title-row">
            <button
              type="button"
              className="proj-title text-control"
              aria-expanded={!isCollapsed}
              onClick={() => onToggleCollapse(project.id)}
            >
              {project.name}
            </button>
              {hasOverdue && <span className="project-deadline-count overdue">{overdueCount} {overdueCount === 1 ? 'vencida' : 'vencidas'}</span>}
              {hasWarning && <span className="project-deadline-count warning">{warningCount} por vencer</span>}
            </div>
            <div className="project-subtitle">
              <span>
                {project.tasks.filter((t) => !t.done).length} tareas pendientes
              </span>
              <span>·</span>
              <div className="project-progress">
                <span
                  style={{
                    width: `${project.tasks.length ? Math.round((project.tasks.filter((t) => t.done).length / project.tasks.length) * 100) : 0}%`,
                  }}
                />
              </div>
              <span>
                {project.tasks.length
                  ? Math.round(
                      (project.tasks.filter((t) => t.done).length /
                        project.tasks.length) *
                        100,
                    )
                  : 0}
                %
              </span>
            </div>
          </div>
        </div>
        <div className="ft-proj-actions">
          <button
            className="button button-ghost"
            onClick={() => onOpenNewTask(project.id)}
            aria-label={`Agregar tarea a ${project.name}`}
          >
            <Icon name="plus" size={14} />
            Tarea
          </button>
          <button
            className="button button-ghost project-add-note"
            onClick={() => onNewProjNoteChange(project.id + '_open', !noteOpen)}
            aria-label={`Agregar nota a ${project.name}`}
            aria-expanded={!!noteOpen}
            aria-controls={`project-note-${project.id}`}
          >
            <Icon name="plus" size={14} />
            Nota
          </button>
          <button
            className="icon-button"
            onClick={() => onToggleCollapse(project.id)}
            aria-label={`${isCollapsed ? 'Expandir' : 'Colapsar'} ${project.name}`}
          >
            <Icon name={isCollapsed ? 'down' : 'up'} size={16} />
          </button>
          <ActionMenu
            label={`Acciones de ${project.name}`}
            items={[
              !hideMembers && {
                label: 'Gestionar miembros',
                icon: 'users',
                onClick: () => onMembersModal(project.id),
              },
              {
                label: 'Descargar contenido para IA',
                icon: 'download',
                onClick: () =>
                  onExportProject
                    ? onExportProject(project)
                    : exportProjectContent(project),
              },
              {
                label: 'Editar proyecto',
                icon: 'edit',
                onClick: () => onEditProject(project),
              },
              {
                label: 'Archivar proyecto',
                icon: 'archive',
                onClick: () =>
                  onConfirm(
                    `¿Archivar "${project.name}"? Podrás recuperarlo desde "Archivados".`,
                    () => onArchiveProject(project.id),
                    { title: 'Confirmar archivado', okLabel: 'Archivar' },
                  ),
              },
              {
                label: 'Eliminar proyecto',
                icon: 'trash',
                danger: true,
                onClick: () =>
                  onConfirm(
                    `¿Eliminar "${project.name}" y TODAS sus tareas y notas?`,
                    () => onDeleteProject(project.id),
                  ),
              },
            ]}
          />
        </div>
      </div>

      {/* Nueva nota rápida */}
      {noteOpen && (
        <div
          id={`project-note-${project.id}`}
          className="project-note-form"
          style={{
            background: 'var(--bg-hover)',
            borderBottom: '1px solid var(--border)',
            padding: '10px 16px',
            display: 'flex',
            gap: 8,
          }}
        >
          <input
            aria-label={`Nueva nota para ${project.name}`}
            placeholder="Agregar nota al proyecto..."
            value={newProjNote[project.id] || ''}
            onChange={(e) => onNewProjNoteChange(project.id, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (newProjNote[project.id] || '').trim()) {
                onAddProjectNote(project.id)
                onNewProjNoteChange(project.id + '_open', false)
              }
            }}
            style={{ ...S.input, flex: 1 }}
            autoFocus
          />
          <button
            onClick={() => {
              onAddProjectNote(project.id)
              onNewProjNoteChange(project.id + '_open', false)
            }}
            style={S.btnPrimary}
            disabled={!(newProjNote[project.id] || '').trim()}
          >
            Agregar
          </button>
          <button
            onClick={() => onNewProjNoteChange(project.id + '_open', false)}
            style={S.btnSecondary}
            aria-label="Cancelar"
          >
            {' '}
            <Icon name="close" size={15} />
          </button>
        </div>
      )}

      {/* Nueva tarea */}
      {newTaskFor === project.id && (
        <div
          className="ft-new-task"
          style={{
            background: 'var(--bg-elevated)',
            padding: '12px 16px',
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            borderBottom: '1px solid var(--border-soft)',
            alignItems: 'center',
          }}
        >
          <input
            placeholder="Descripción tarea *"
            value={newTask.title}
            onChange={(e) =>
              onNewTaskChange({ ...newTask, title: e.target.value })
            }
            onKeyDown={(e) =>
              e.key === 'Enter' && newTask.title && onAddTask(project.id)
            }
            style={{ ...S.input, flex: '2 1 160px' }}
            autoFocus
          />
          <input
            placeholder="Responsable (opcional)"
            value={newTask.responsible}
            onChange={(e) =>
              onNewTaskChange({ ...newTask, responsible: e.target.value })
            }
            onKeyDown={(e) =>
              e.key === 'Enter' && newTask.title && onAddTask(project.id)
            }
            style={{ ...S.input, flex: '1 1 140px' }}
          />
          <div
            style={{
              display: 'flex',
              gap: 4,
              alignItems: 'center',
              flex: '0 1 180px',
            }}
            title="Vencimiento (opcional)"
          >
            <input
              value={newTask.due_day || ''}
              onChange={(e) =>
                onNewTaskChange({
                  ...newTask,
                  due_day: e.target.value.replace(/\D/g, '').slice(0, 2),
                })
              }
              onKeyDown={(e) =>
                e.key === 'Enter' && newTask.title && onAddTask(project.id)
              }
              aria-label="Día de vencimiento"
              placeholder="DD"
              maxLength={2}
              style={{
                ...S.input,
                width: 44,
                textAlign: 'center',
                padding: '8px 4px',
              }}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>/</span>
            <input
              value={newTask.due_month || ''}
              onChange={(e) =>
                onNewTaskChange({
                  ...newTask,
                  due_month: e.target.value.replace(/\D/g, '').slice(0, 2),
                })
              }
              onKeyDown={(e) =>
                e.key === 'Enter' && newTask.title && onAddTask(project.id)
              }
              aria-label="Mes de vencimiento"
              placeholder="MM"
              maxLength={2}
              style={{
                ...S.input,
                width: 44,
                textAlign: 'center',
                padding: '8px 4px',
              }}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>/</span>
            <input
              value={newTask.due_year || String(new Date().getFullYear())}
              onChange={(e) =>
                onNewTaskChange({
                  ...newTask,
                  due_year: e.target.value.replace(/\D/g, '').slice(0, 4),
                })
              }
              onKeyDown={(e) =>
                e.key === 'Enter' && newTask.title && onAddTask(project.id)
              }
              aria-label="Año de vencimiento"
              placeholder="AAAA"
              maxLength={4}
              style={{
                ...S.input,
                width: 58,
                textAlign: 'center',
                padding: '8px 4px',
              }}
            />
          </div>
          <select
            value={newTask.priority || ''}
            onChange={(e) =>
              onNewTaskChange({ ...newTask, priority: e.target.value })
            }
            style={{ ...S.select, flex: '0 1 130px' }}
            title="Prioridad (opcional)"
          >
            <option value="">Sin prioridad</option>
            {Object.entries(PRIORITY).map(([key, p]) => (
              <option key={key} value={key}>
                {p.emoji} {p.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => onAddTask(project.id)}
            style={S.btnPrimary}
            disabled={!newTask.title}
          >
            Agregar
          </button>
          <button
            onClick={() => onOpenNewTask(null)}
            style={S.btnSecondary}
            aria-label="Cancelar"
          >
            {' '}
            <Icon name="close" size={15} />
          </button>
        </div>
      )}

      {/* Lista mixta */}
      {!isCollapsed && (
        <div className="project-items">
          {mixedItems.length === 0 && (
            <div
              style={{
                padding: '16px',
                textAlign: 'center',
                color: 'var(--text-faint)',
                fontSize: 13,
              }}
            >
              Sin tareas ni notas aún.
            </div>
          )}
          {mixedItems.map((item, idx) => {
            if (item._type === 'note')
              return (
                <div
                  key={`note-${item.id}`}
                  className="project-note-row"
                  style={{
                    borderTop: idx === 0 ? 'none' : '1px solid var(--border)',
                    background: 'var(--bg-surface)',
                  }}
                >
                  <div
                    style={{
                      padding: '10px 16px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      background: 'var(--bg-surface)',
                    }}
                  >
                    <div style={{ flexShrink: 0, marginTop: 3 }}>
                      <span
                        style={{
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-secondary)',
                          padding: '2px 7px',
                          borderRadius: 10,
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      >
                        NOTA
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          marginBottom: 3,
                        }}
                      >
                        {item.author || '—'} ·{' '}
                        <span
                          role="button"
                          tabIndex={0}
                          onKeyDown={activateOnKeyboard}
                          onClick={() =>
                            onEditCreatedAt('note', project.id, null, item)
                          }
                          style={{
                            cursor: 'pointer',
                            textDecoration: 'underline dotted',
                            color: 'var(--text-secondary)',
                          }}
                          title="Editar fecha de registro"
                        >
                          {fmtDate(item.created_at)}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: 'var(--text-content)',
                          lineHeight: 1.5,
                        }}
                      >
                        {item.text}
                      </div>
                    </div>
                    <ActionMenu
                      label="Acciones de la nota"
                      items={[
                        {
                          label: 'Mover a tarea',
                          icon: 'move',
                          onClick: () => onMoveNote(item, project.id),
                        },
                        {
                          label: 'Editar nota',
                          icon: 'edit',
                          onClick: () => onEditNote(project.id, item),
                        },
                        {
                          label: 'Eliminar nota',
                          icon: 'trash',
                          danger: true,
                          onClick: () =>
                            onConfirm('¿Eliminar esta nota?', () =>
                              onDeleteNote(project.id, item.id),
                            ),
                        },
                      ]}
                    />
                  </div>
                </div>
              )

            return (
              <TaskItem
                key={`task-${item.id}`}
                task={item}
                expanded={expanded}
                onToggle={onToggleTask}
                onExpand={onExpand}
                onEdit={(task) => onEditTask(item.projectId, task)}
                onDelete={onDeleteTask}
                onEditComment={onEditComment}
                onDeleteComment={onDeleteComment}
                onMoveComment={onMoveComment}
                onAddComment={onAddComment}
                newComment={newComment[item.id]}
                onNewCommentChange={onNewCommentChange}
                onConfirm={onConfirm}
                onEditDueDate={(task) => onEditDueDate(item.projectId, task)}
                onEditCreatedAt={(type, tId, item2) =>
                  onEditCreatedAt(type, project.id, tId, item2)
                }
              />
            )
          })}
        </div>
      )}

      {isCollapsed && (
        <div className="project-summary">
          <span>
            <Icon name="tasks" size={13} />
            {project.tasks.filter((t) => !t.done).length} pendientes
          </span>
          <span>
            <Icon name="check" size={13} />
            {project.tasks.filter((t) => t.done).length} completadas
          </span>
          <span>
            <Icon name="note" size={13} />
            {(project.history_loaded === false
              ? project.notes_count
              : project.notes?.length) || 0}{' '}
            notas
          </span>
          {(hasOverdue || hasWarning) && (
            <span
              className="status-badge summary-status"
              style={{
                '--status-color':
                  STATUS[hasOverdue ? 'overdue' : 'warning'].badge,
                '--status-bg': STATUS[hasOverdue ? 'overdue' : 'warning'].bg,
              }}
            >
              <Icon name="clock" size={12} />
              {hasOverdue ? 'Tareas vencidas' : 'Tareas por vencer'}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
