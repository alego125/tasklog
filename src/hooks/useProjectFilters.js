import { useMemo } from 'react'
import { getStatus } from '../utils/helpers.js'
export function useProjectFilters(
  proj,
  { search, filterStatuses, filterProject, showDone, filterDateFrom, filterDateTo }
) {
  // ── Filters ───────────────────────────────────────────────────
  const baseTaskFilter = (t) => {
    const st = getStatus(t.due_date, t.done)
    return (
      (filterStatuses.length === 0 || filterStatuses.includes(st)) &&
      (filterProject === 'all' || t.projectId === parseInt(filterProject)) &&
      (showDone || !t.done) &&
      (!filterDateFrom || (t.due_date && String(t.due_date).slice(0, 10) >= filterDateFrom)) &&
      (!filterDateTo || (t.due_date && String(t.due_date).slice(0, 10) <= filterDateTo))
    )
  }
  const matchesTaskSearch = (t) => {
    const q = search.toLowerCase()
    return (
      !q ||
      t.title.toLowerCase().includes(q) ||
      t.projectName.toLowerCase().includes(q) ||
      (t.responsible || '').toLowerCase().includes(q) ||
      t.comments.some(
        (c) => c.text.toLowerCase().includes(q) || (c.author || '').toLowerCase().includes(q)
      )
    )
  }

  const filtered = useMemo(
    () => proj.allTasks.filter((t) => baseTaskFilter(t) && matchesTaskSearch(t)),
    [proj.allTasks, search, filterStatuses, filterProject, showDone, filterDateFrom, filterDateTo]
  )

  // Mismos filtros que `filtered` pero sin el texto de búsqueda — se usa en la
  // vista Proyectos cuando el nombre del proyecto ya matchea la búsqueda, para
  // mostrar todas sus tareas (no solo las que además contienen el término).
  const filteredIgnoringSearch = useMemo(
    () => proj.allTasks.filter(baseTaskFilter),
    [proj.allTasks, filterStatuses, filterProject, showDone, filterDateFrom, filterDateTo]
  )

  const filteredProjectNotes = useMemo(() => {
    if (!search.trim()) return []
    const q = search.toLowerCase()
    return proj.projects
      .filter((p) => filterProject === 'all' || p.id === parseInt(filterProject))
      .flatMap((p) =>
        (p.notes || [])
          .filter((n) => {
            if (!n.text.toLowerCase().includes(q) && !(n.author || '').toLowerCase().includes(q))
              return false
            if (filterDateFrom && String(n.created_at).slice(0, 10) < filterDateFrom) return false
            if (filterDateTo && String(n.created_at).slice(0, 10) > filterDateTo) return false
            return true
          })
          .map((n) => ({ ...n, projectId: p.id, projectName: p.name, projectColor: p.color }))
      )
  }, [proj.projects, search, filterProject, filterDateFrom, filterDateTo])

  const matchingComments = useMemo(() => {
    if (!search.trim()) return {}
    const q = search.toLowerCase()
    const result = {}
    proj.allTasks.forEach((t) => {
      if (filterProject !== 'all' && t.projectId !== parseInt(filterProject)) return
      const hits = t.comments.filter((c) => {
        if (!c.text.toLowerCase().includes(q) && !(c.author || '').toLowerCase().includes(q))
          return false
        if (filterDateFrom && String(c.created_at).slice(0, 10) < filterDateFrom) return false
        if (filterDateTo && String(c.created_at).slice(0, 10) > filterDateTo) return false
        return true
      })
      if (hits.length) result[t.id] = hits
    })
    return result
  }, [proj.allTasks, search, filterProject, filterDateFrom, filterDateTo])

  return { filtered, filteredIgnoringSearch, filteredProjectNotes, matchingComments }
}
