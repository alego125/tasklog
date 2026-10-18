const { fail } = require('./http')
const bad = (name) => fail(400, `Campo inválido: ${name}`)
function id(value, name = 'id') {
  if (!['number', 'string'].includes(typeof value)) bad(name)
  if (
    !/^[1-9]\d*$/.test(String(value)) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) > 2147483647
  )
    bad(name)
  return Number(value)
}
function text(value, name, max = 500, optional = false) {
  if (optional && (value === undefined || value === null || value === '')) return null
  if (typeof value !== 'string' || !value.trim() || value.length > max) bad(name)
  return value.trim()
}
function date(value, name, optional = true) {
  if (optional && (value === undefined || value === null || value === '')) return null
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    bad(name)
  return value
}
function timestamp(value, name) {
  if (
    typeof value !== 'string' ||
    value.length > 40 ||
    !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2}))?$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    bad(name)
  date(value.slice(0, 10), name, false)
  // A date edited in the UI is anchored at noon UTC to preserve its calendar day in Argentina.
  return value.length === 10 ? `${value}T12:00:00.000Z` : new Date(value).toISOString()
}
function color(value = '#7a9e7e') {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) bad('color')
  return value
}
function priority(value) {
  if (value === undefined || value === null || value === '') return null
  if (!['alta', 'media', 'baja'].includes(value)) bad('priority')
  return value
}
function boolean(value, name) {
  if (typeof value !== 'boolean') bad(name)
  return value
}
function password(value) {
  if (typeof value !== 'string' || value.length < 10 || Buffer.byteLength(value, 'utf8') > 72)
    bad('password (10 caracteres mínimo, 72 bytes máximo)')
  return value
}
function credentials(body, { profile = false } = {}) {
  const name = text(body.name, 'name', 120)
  const username = text(body.username, 'username', 40).toLowerCase()
  if (!/^[a-z0-9_]{3,40}$/.test(username)) bad('username')
  const email = text(body.email, 'email', 254).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) bad('email')
  return {
    name,
    username,
    email,
    ...(!profile || body.password ? { password: password(body.password) } : {}),
  }
}
function task(body, partial = false) {
  const out = {}
  const fields = {
    title: (v) => text(v, 'title', 500),
    responsible: (v) => text(v, 'responsible', 120, true),
    due_date: (v) => date(v, 'due_date'),
    priority,
    project_id: (v) => id(v, 'project_id'),
    created_at: (v) => timestamp(v, 'created_at'),
  }
  for (const [key, validate] of Object.entries(fields)) {
    if (Object.hasOwn(body, key)) out[key] = validate(body[key])
    else if (!partial && ['title', 'project_id'].includes(key)) bad(key)
  }
  if (partial && !Object.keys(out).length) bad('tarea vacía')
  return out
}
function pagination(query) {
  const limit = query.limit === undefined ? 50 : Number(query.limit)
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) bad('limit')
  const after = query.after === undefined ? 0 : id(query.after, 'after')
  return { limit, after }
}
module.exports = {
  id,
  text,
  date,
  timestamp,
  color,
  priority,
  boolean,
  password,
  credentials,
  task,
  pagination,
  bad,
}
