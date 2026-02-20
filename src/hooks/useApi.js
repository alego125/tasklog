// En desarrollo: Vite hace proxy /api → localhost:3001
// En producción: apunta al backend de Render
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
  getProjects:   ()            => request('GET',    '/projects'),
  createProject: (name, color) => request('POST',   '/projects', { name, color }),
  deleteProject: (id)          => request('DELETE', `/projects/${id}`),
  createTask:    (data)        => request('POST',   '/tasks', data),
  updateTask:    (id, data)    => request('PUT',    `/tasks/${id}`, data),
  toggleTask:    (id)          => request('PATCH',  `/tasks/${id}/toggle`),
  deleteTask:    (id)          => request('DELETE', `/tasks/${id}`),
  createComment: (data)        => request('POST',   '/comments', data),
  updateComment: (id, text)    => request('PUT',    `/comments/${id}`, { text }),
  deleteComment: (id)          => request('DELETE', `/comments/${id}`),
}
