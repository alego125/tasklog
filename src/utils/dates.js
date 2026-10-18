export const BUSINESS_TIME_ZONE = 'America/Argentina/Buenos_Aires'
export function asInstant(value) {
  const text = String(value).replace(' ', 'T')
  return new Date(/[zZ]$|[+-]\d{2}:\d{2}$/.test(text) ? text : `${text}Z`)
}
export function localDate(value = new Date()) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = value instanceof Date ? value : asInstant(value)
  if (!Number.isFinite(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const part = (type) => parts.find((p) => p.type === type).value
  return `${part('year')}-${part('month')}-${part('day')}`
}
export function getStatus(due, done, today = localDate()) {
  if (done) return 'done'
  if (!due) return 'ok'
  const day = String(due).slice(0, 10)
  if (day < today) return 'overdue'
  const diff = (Date.parse(`${day}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000
  return diff <= 3 ? 'warning' : 'ok'
}
export function fmtSimpleDate(value) {
  if (!value) return ''
  const [y, m, d] = String(value).slice(0, 10).split('-')
  return d && m && y ? `${d}/${m}/${y}` : ''
}
export function fmtDate(value) {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return fmtSimpleDate(value)
  const instant = asInstant(value)
  if (!Number.isFinite(instant.getTime())) return ''
  const time = new Intl.DateTimeFormat('es-AR', {
    timeZone: BUSINESS_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instant)
  return `${fmtSimpleDate(localDate(instant))} ${time}`
}
