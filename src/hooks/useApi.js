const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  // Projects
  getProjects:   ()               => request('GET',    '/projects'),
  createProject: (name, color)    => request('POST',   '/projects', { name, color }),
  updateProject: (id, name, color)=> request('PUT',    `/projects/${id}`, { name, color }),
  archiveProject:   (id) => request('PATCH',  `/projects/${id}/archive`),
  unarchiveProject: (id) => request('PATCH',  `/projects/${id}/unarchive`),
  getArchivedProjects: () => request('GET', '/projects/archived'),
  deleteProject:    (id) => request('DELETE', `/projects/${id}`),
  // Tasks
  createTask:    (data)           => request('POST',   '/tasks', data),
  updateTask:    (id, data)       => request('PUT',    `/tasks/${id}`, data),
  toggleTask:    (id)             => request('PATCH',  `/tasks/${id}/toggle`),
  deleteTask:    (id)             => request('DELETE', `/tasks/${id}`),
  // Task comments
  createComment: (data)           => request('POST',   '/comments', data),
  updateComment: (id, text)       => request('PUT',    `/comments/${id}`, { text }),
  deleteComment: (id)             => request('DELETE', `/comments/${id}`),
  moveCommentToProject: (id, project_id) => request('POST', `/comments/${id}/move-to-project`, { project_id }),
  // Project notes
  createProjectNote: (data)       => request('POST',   '/project-notes', data),
  updateProjectNote: (id, text)   => request('PUT',    `/project-notes/${id}`, { text }),
  deleteProjectNote: (id)         => request('DELETE', `/project-notes/${id}`),
  moveNoteToTask: (id, task_id)   => request('POST',   `/project-notes/${id}/move-to-task`, { task_id }),
}
