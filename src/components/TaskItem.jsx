import {
  S,
  STATUS,
  getStatus,
  fmtDate,
  fmtSimpleDate,
  PRIORITY,
} from '../utils/helpers.js'
import Icon from './Icon.jsx'
import ActionMenu from './ActionMenu.jsx'
export default function TaskItem({
  task,
  expanded,
  onToggle,
  onExpand,
  onEdit,
  onDelete,
  onEditComment,
  onDeleteComment,
  onMoveComment,
  onAddComment,
  newComment,
  onNewCommentChange,
  onConfirm,
  onEditDueDate,
  onEditCreatedAt,
  showProject,
}) {
  const status = getStatus(task.due_date, task.done),
    cfg = STATUS[status],
    isExp = expanded === task.id
  const sortedComments = [...(task.comments || [])].sort((a, b) =>
    (b.created_at || '').localeCompare(a.created_at || ''),
  )
  return (
    <div
      id={`task-${task.id}`}
      className={`task-item ${isExp ? 'expanded' : ''}`}
      data-status={status}
    >
      <div className="ft-task-row">
        <button
          type="button"
          className="task-checkbox"
          role="checkbox"
          aria-checked={task.done}
          aria-label={`Completar ${task.title}`}
          disabled={task._optimistic}
          onClick={() => onToggle(task.id)}
        >
          <span>{task.done && <Icon name="check" size={13} />}</span>
        </button>
        <div className="task-content">
          <button
            className="task-title text-control"
            aria-expanded={isExp}
            onClick={() => onExpand(isExp ? null : task.id)}
            style={{
              textDecoration: task.done ? 'line-through' : undefined,
              color: task.done ? 'var(--text-muted)' : status === 'overdue' ? 'var(--task-overdue-ink)' : status === 'warning' ? 'var(--task-warning-ink)' : 'var(--task-title)',
              fontWeight: status === 'overdue' || status === 'warning' ? 700 : undefined,
            }}
          >
            {task.title}
          </button>
          <div className="ft-task-meta">
            {showProject && (
              <span>
                <Icon name="folder" size={12} />
                {task.projectName}
              </span>
            )}
            {task.priority && PRIORITY[task.priority] && (
              <span
                style={{
                  color:
                    task.priority === 'alta'
                      ? 'var(--status-overdue)'
                      : task.priority === 'media'
                        ? 'var(--status-warning)'
                        : 'var(--status-done)',
                }}
              >
                {PRIORITY[task.priority].label}
              </span>
            )}
            {task.responsible && (
              <span>
                <Icon name="user" size={12} />
                {task.responsible}
              </span>
            )}
            {task.due_date && (
              <button
                className="text-control task-date"
                onClick={() => onEditDueDate?.(task)}
                title="Editar vencimiento"
              >
                <Icon name="calendar" size={12} />
                <span className="task-date-label">Vencimiento:</span>
                {fmtSimpleDate(task.due_date)}
              </button>
            )}
            <button
              className="text-control task-date registration-date"
              onClick={() => onEditCreatedAt?.('task', null, task)}
              title="Editar fecha de registro"
            >
              <Icon name="clock" size={12} />
              <span className="task-date-label">Registro:</span>
              {fmtDate(task.created_at)}
            </button>
            <span>
              <Icon name="message" size={12} />
              {task.comments_count ?? task.comments?.length ?? 0}
            </span>
          </div>
        </div>
        <span
          className="status-badge"
          style={{ '--status-color': cfg.badge, '--status-bg': cfg.bg }}
        >
          {cfg.label}
        </span>
        <div className="ft-task-actions">
          <button
            className="icon-button"
            aria-label={isExp ? 'Colapsar bitácora' : 'Expandir bitácora'}
            aria-expanded={isExp}
            onClick={() => onExpand(isExp ? null : task.id)}
          >
            <Icon name={isExp ? 'up' : 'down'} size={14} />
          </button>
          <ActionMenu
            label={`Acciones de ${task.title}`}
            items={[
              {
                label: 'Editar tarea',
                icon: 'edit',
                onClick: () => onEdit(task),
              },
              {
                label: 'Editar vencimiento',
                icon: 'calendar',
                onClick: () => onEditDueDate?.(task),
              },
              {
                label: 'Editar fecha de registro',
                icon: 'clock',
                onClick: () => onEditCreatedAt?.('task', null, task),
              },
              {
                label: isExp ? 'Cerrar bitácora' : 'Abrir bitácora',
                icon: 'message',
                onClick: () => onExpand(isExp ? null : task.id),
              },
              {
                label: 'Eliminar tarea',
                icon: 'trash',
                danger: true,
                onClick: () =>
                  onConfirm(`¿Eliminar "${task.title}"?`, () =>
                    onDelete(task.projectId, task.id),
                  ),
              },
            ]}
          />
        </div>
      </div>
      {isExp && (
        <div className="ft-task-comments">
          <div className="section-label">Bitácora de la tarea</div>
          {(task.comments_count ?? task.comments?.length ?? 0) === 0 && (
            <p
              style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                marginBottom: 12,
              }}
            >
              Todavía no hay notas. Agregá la primera actualización.
            </p>
          )}
          {sortedComments.map((c) => (
            <div key={c.id} className="comment-card">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="comment-meta">
                  {c.author || '—'} ·{' '}
                  <button
                    className="text-control"
                    title="Editar fecha de registro"
                    onClick={() => onEditCreatedAt?.('comment', task.id, c)}
                  >
                    {fmtDate(c.created_at)}
                  </button>
                </div>
                <div className="comment-text">{c.text}</div>
              </div>
              <ActionMenu
                label="Acciones de la nota"
                items={[
                  {
                    label: 'Mover a proyecto',
                    icon: 'move',
                    onClick: () => onMoveComment(c, task.projectId, task.id),
                  },
                  {
                    label: 'Editar nota',
                    icon: 'edit',
                    onClick: () => onEditComment(task.projectId, task.id, c),
                  },
                  {
                    label: 'Eliminar nota',
                    icon: 'trash',
                    danger: true,
                    onClick: () =>
                      onConfirm('¿Eliminar esta nota?', () =>
                        onDeleteComment(task.projectId, task.id, c.id),
                      ),
                  },
                ]}
              />
            </div>
          ))}
          <div className="inline-form">
            <input
              aria-label={`Nueva nota para ${task.title}`}
              placeholder="Escribí una actualización…"
              value={newComment || ''}
              onChange={(e) => onNewCommentChange(task.id, e.target.value)}
              onKeyDown={(e) =>
                e.key === 'Enter' &&
                onAddComment(task.projectId, task.id, newComment || '')
              }
              style={{ ...S.input, flex: 1 }}
            />
            <button
              style={S.btnPrimary}
              onClick={() =>
                onAddComment(task.projectId, task.id, newComment || '')
              }
            >
              Agregar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
