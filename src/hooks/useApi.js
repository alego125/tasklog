const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
  : '/api'

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}
export function isNetworkError(error) {
  return error?.status === 0 || error?.message === 'SIN_CONEXION'
}
export function clearSession() {
  for (const key of ['ft_token', 'ft_user', 'ft_login_time']) localStorage.removeItem(key)
  window.dispatchEvent(new Event('ft_logout'))
}
export async function request(method, path, body) {
  const token = localStorage.getItem('ft_token')
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  let response
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45000)
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
  } catch {
    throw new ApiError('SIN_CONEXION')
  } finally {
    clearTimeout(timeout)
  }
  if (token && token !== localStorage.getItem('ft_token'))
    throw new ApiError('La sesión cambió', 401)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 401 && !['/auth/login', '/auth/register'].includes(path)) clearSession()
    throw new ApiError(data.error || `HTTP ${response.status}`, response.status)
  }
  return data
}

// Keep each database query bounded while preserving complete global filters and exports.
export async function collection(path) {
  const items = []
  const seen = new Set()
  let after = null
  do {
    const page = await request(
      'GET',
      `${path}${path.includes('?') ? '&' : '?'}limit=50${after ? `&after=${after}` : ''}`
    )
    items.push(...page.items)
    after = page.nextCursor
    if (after && seen.has(after)) throw new ApiError('Paginación inválida', 500)
    seen.add(after)
  } while (after)
  return items
}

export const api = {
  // Auth
  register: (name, username, email, password) =>
    request('POST', '/auth/register', { name, username, email, password }),
  login: (username, password) => request('POST', '/auth/login', { username, password }),
  me: () => request('GET', '/auth/me'),
  // Users
  searchUsers: (q) => request('GET', `/users/search?q=${encodeURIComponent(q)}`),
  // Projects (meetingId opcional: temas de una reunión en vez de proyectos "de verdad")
  getProjects: (meetingId, history = false) =>
    collection(
      `/projects?history=${history ? 'all' : 'none'}${meetingId ? `&meeting_id=${meetingId}` : ''}`
    ),
  getProject: (id) => request('GET', `/projects/${id}`),
  createProject: (name, color, meetingId) =>
    request('POST', '/projects', { name, color, meeting_id: meetingId || undefined }),
  updateProject: (id, name, color) => request('PUT', `/projects/${id}`, { name, color }),
  archiveProject: (id) => request('PATCH', `/projects/${id}/archive`),
  unarchiveProject: (id) => request('PATCH', `/projects/${id}/unarchive`),
  deleteProject: (id) => request('DELETE', `/projects/${id}`),
  getArchivedProjects: (meetingId) =>
    collection(meetingId ? `/projects/archived?meeting_id=${meetingId}` : '/projects/archived'),
  // Meetings (un solo dueño, sin miembros compartidos)
  getMeetings: () => collection('/meetings'),
  getArchivedMeetings: () => collection('/meetings/archived'),
  createMeeting: (name, color) => request('POST', '/meetings', { name, color }),
  updateMeeting: (id, name, color) => request('PUT', `/meetings/${id}`, { name, color }),
  archiveMeeting: (id) => request('PATCH', `/meetings/${id}/archive`),
  unarchiveMeeting: (id) => request('PATCH', `/meetings/${id}/unarchive`),
  deleteMeeting: (id) => request('DELETE', `/meetings/${id}`),
  getMeetingExport: (id) => request('GET', `/meetings/${id}/export`),
  // Members
  addMember: (projectId, userId) =>
    request('POST', `/projects/${projectId}/members`, { user_id: userId }),
  removeMember: (projectId, userId) =>
    request('DELETE', `/projects/${projectId}/members/${userId}`),
  // Tasks
  createTask: (data) => request('POST', '/tasks', data),
  updateTask: (id, data) => request('PUT', `/tasks/${id}`, data),
  toggleTask: (id) => request('PATCH', `/tasks/${id}/toggle`),
  deleteTask: (id) => request('DELETE', `/tasks/${id}`),
  // Task comments
  createComment: (data) => request('POST', '/comments', data),
  updateComment: (id, data) =>
    request('PUT', `/comments/${id}`, typeof data === 'string' ? { text: data } : data),
  deleteComment: (id) => request('DELETE', `/comments/${id}`),
  moveCommentToProject: (id, project_id) =>
    request('POST', `/comments/${id}/move-to-project`, { project_id }),
  // Project notes
  createProjectNote: (data) => request('POST', '/project-notes', data),
  updateProjectNote: (id, data) =>
    request('PUT', `/project-notes/${id}`, typeof data === 'string' ? { text: data } : data),
  deleteProjectNote: (id) => request('DELETE', `/project-notes/${id}`),
  moveNoteToTask: (id, task_id) =>
    request('POST', `/project-notes/${id}/move-to-task`, { task_id }),
  // Backup
  restore: (data, memberships = false) =>
    request('POST', `/restore?memberships=${memberships}`, data),
  backup: () => request('GET', '/backup'),
  logout: () => request('POST', '/auth/logout', {}),
  updateProfile: (data) => request('PUT', '/auth/me', data),
}
