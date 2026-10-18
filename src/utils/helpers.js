export { getStatus, localDate, fmtDate, fmtSimpleDate } from './dates.js'

export const STATUS = {
  done: {
    bg: 'var(--status-done-bg)',
    border: 'var(--status-done)',
    badge: 'var(--status-done)',
    label: 'Completada',
  },
  overdue: {
    bg: 'var(--status-overdue-bg)',
    border: 'var(--status-overdue)',
    badge: 'var(--status-overdue)',
    label: 'Vencida',
  },
  warning: {
    bg: 'var(--status-warning-bg)',
    border: 'var(--status-warning)',
    badge: 'var(--status-warning)',
    label: 'Por vencer',
  },
  ok: {
    bg: 'var(--status-ok-bg)',
    border: 'var(--border)',
    badge: 'var(--status-ok)',
    label: 'Sin vencer',
  },
}

export const COLORS = [
  '#7a9e7e',
  '#c4784a',
  '#4a8ea0',
  '#9a7a5a',
  '#887ab0',
  '#4a8a70',
  '#b07840',
  '#7a8a4a',
]

export const PRIORITY = {
  alta: { label: 'Alta', color: 'var(--status-overdue)', emoji: '' },
  media: { label: 'Media', color: 'var(--status-warning)', emoji: '' },
  baja: { label: 'Baja', color: 'var(--status-done)', emoji: '' },
}

// ── Shared styles ─────────────────────────────────────────────────
export const S = {
  input: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-soft)',
    color: 'var(--text-primary)',
    padding: '8px 12px',
    borderRadius: 8,
    fontSize: 13,
    minHeight: 42,
    outline: 'none',
    boxSizing: 'border-box',
  },
  select: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-soft)',
    color: 'var(--text-primary)',
    padding: '8px 12px',
    borderRadius: 8,
    fontSize: 13,
    minHeight: 42,
    outline: 'none',
    cursor: 'pointer',
  },
  btnPrimary: {
    background: 'var(--btn-primary)',
    border: 'none',
    color: 'var(--btn-primary-text)',
    padding: '8px 16px',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 13,
    minHeight: 42,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  btnSecondary: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-soft)',
    color: 'var(--text-secondary)',
    padding: '8px 14px',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 13,
    minHeight: 42,
    whiteSpace: 'nowrap',
  },
  iconBtn: {
    background: 'transparent',
    border: '1px solid var(--border-soft)',
    color: 'var(--text-secondary)',
    width: 40,
    height: 40,
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    minHeight: 42,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    flexShrink: 0,
  },
}
