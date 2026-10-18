import { useState } from 'react'
import Icon from './Icon.jsx'
export default function WorkspaceToolbar({
  search,
  setSearch,
  filterProject,
  setFilterProject,
  projects,
  showDone,
  setShowDone,
  filterDateFrom,
  setFilterDateFrom,
  filterDateTo,
  setFilterDateTo,
  viewMode,
}) {
  const [open, setOpen] = useState(false)
  const dashboard = viewMode === 'dashboard'
  const active =
    filterProject !== 'all' ||
    (!dashboard && (filterDateFrom || filterDateTo || !showDone))
  return (
    <section className="workspace-toolbar" aria-label="Buscar y filtrar">
      <div className="toolbar-main">
        {!dashboard && (
          <div className="search-field">
            <Icon name="search" />
            <input
              aria-label="Buscar por tarea, proyecto o responsable"
              placeholder="Buscar en tu espacio…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className="icon-button"
                aria-label="Limpiar búsqueda"
                onClick={() => setSearch('')}
              >
                <Icon name="close" size={15} />
              </button>
            )}
          </div>
        )}
        <button
          className={`button filter-toggle ${active ? 'selected' : ''}`}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <Icon name="filter" size={16} />
          Filtros{active && <span className="filter-dot" />}
        </button>
        <span className="toolbar-hint">
          {projects.length} proyectos en tu espacio
        </span>
      </div>
      {open && (
        <div className="filter-panel">
          <label>
            Proyecto
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
            >
              <option value="all">Todos los proyectos</option>
              {[...projects]
                .sort((a, b) => a.name.localeCompare(b.name, 'es'))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
          {!dashboard && (
            <>
              <label>
                Desde
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                />
              </label>
              <label>
                Hasta
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                />
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={showDone}
                  onChange={(e) => setShowDone(e.target.checked)}
                />
                Mostrar completadas
              </label>
              <p className="filter-explanation">
                {viewMode === 'bitacoras'
                  ? 'Las fechas corresponden al registro de las notas.'
                  : 'Las fechas filtran el vencimiento de tareas y el registro de notas.'}
              </p>
            </>
          )}
          {active && (
            <button
              className="button button-ghost"
              onClick={() => {
                setFilterProject('all')
                setFilterDateFrom('')
                setFilterDateTo('')
                setShowDone(true)
              }}
            >
              Restablecer filtros
            </button>
          )}
        </div>
      )}
    </section>
  )
}
