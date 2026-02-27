const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'

function getToken() {
  return localStorage.getItem('ft_token')
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  })

  if (res.status === 401) {
    localStorage.removeItem('ft_token')
    localStorage.removeItem('ft_user')
    window.dispatchEvent(new Event('ft_logout'))
    return
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  // Auth
  register: (name, username, email, password) => request('POST', '/auth/register', { name, username, email, password }),
  login:    (username, password)     => request('POST', '/auth/login',    { username, password }),
  me:       ()                       => request('GET',  '/auth/me'),
  // Users
  searchUsers: (q) => request('GET', `/users/search?q=${encodeURIComponent(q)}`),
  // Projects
  getProjects:      ()               => request('GET',    '/projects'),
  createProject:    (name, color)    => request('POST',   '/projects', { name, color }),
  updateProject:    (id, name, color)=> request('PUT',    `/projects/${id}`, { name, color }),
  archiveProject:   (id)             => request('PATCH',  `/projects/${id}/archive`),
  unarchiveProject: (id)             => request('PATCH',  `/projects/${id}/unarchive`),
  deleteProject:    (id)             => request('DELETE', `/projects/${id}`),
  getArchivedProjects: ()            => request('GET',    '/projects/archived'),
  // Members
  addMember:    (projectId, userId)  => request('POST',   `/projects/${projectId}/members`, { user_id: userId }),
  removeMember: (projectId, userId)  => request('DELETE', `/projects/${projectId}/members/${userId}`),
  // Tasks
  createTask: (data)     => request('POST',  '/tasks', data),
  updateTask: (id, data) => request('PUT',   `/tasks/${id}`, data),
  toggleTask: (id)       => request('PATCH', `/tasks/${id}/toggle`),
  deleteTask: (id)       => request('DELETE',`/tasks/${id}`),
  // Task comments
  createComment:        (data)           => request('POST',   '/comments', data),
  updateComment:        (id, text)       => request('PUT',    `/comments/${id}`, { text }),
  deleteComment:        (id)             => request('DELETE', `/comments/${id}`),
  moveCommentToProject: (id, project_id) => request('POST',   `/comments/${id}/move-to-project`, { project_id }),
  // Project notes
  createProjectNote:  (data)       => request('POST',   '/project-notes', data),
  updateProjectNote:  (id, text)   => request('PUT',    `/project-notes/${id}`, { text }),
  deleteProjectNote:  (id)         => request('DELETE', `/project-notes/${id}`),
  moveNoteToTask:     (id, task_id)=> request('POST',   `/project-notes/${id}/move-to-task`, { task_id }),
  // Backup
  restore: (data) => request('POST', '/restore', data),
}
