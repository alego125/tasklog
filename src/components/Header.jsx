import { useEffect, useState } from 'react'
import Icon, { Brand } from './Icon.jsx'
import { getStatus } from '../utils/helpers.js'
const views = [
  ['projects', 'Proyectos', 'folder'],
  ['tasks', 'Tareas', 'tasks'],
  ['kanban', 'Semana', 'calendar'],
  ['meetings', 'Reuniones', 'users'],
  ['bitacoras', 'Bitácoras', 'message'],
  ['dashboard', 'Dashboard', 'chart'],
]
export default function Header({
  currentUser,
  projects = [],
  theme,
  archiveView,
  viewMode,
  onNavigate,
  onNewProject,
  onArchiveView,
  onExportExcel,
  onExportReportPrompt,
  onBackup,
  onToggleTheme,
  onProfile,
  onRestore,
  onLogout,
  userMenuOpen,
  setUserMenuOpen,
  mobileMenuOpen,
  setMobileMenuOpen,
  loadArchived,
}) {
  const overdueProjectCount = projects.filter(project =>
    !project.archived && project.tasks?.some(task => getStatus(task.due_date, task.done) === 'overdue'),
  ).length
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  useEffect(() => {
    document.body.classList.toggle('sidebar-collapsed', sidebarCollapsed)
    return () => document.body.classList.remove('sidebar-collapsed')
  }, [sidebarCollapsed])
  useEffect(() => {
    const esc = (e) => {
      if (e.key === 'Escape') {
        setUserMenuOpen(false)
        setMobileMenuOpen(false)
      }
    }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [setUserMenuOpen, setMobileMenuOpen])
  const close = () => {
    setUserMenuOpen(false)
    setMobileMenuOpen(false)
  }
  const action = (fn) => {
    document
      .querySelector(
        `[aria-label="${mobileMenuOpen ? 'Menú principal' : 'Menú de usuario'}"]`,
      )
      ?.focus()
    close()
    fn()
  }
  const links = (
    <>
      {views.map(([id, label, icon]) => (
        <button
          key={id}
          className={`nav-item ${!archiveView && viewMode === id ? 'active' : ''}`}
          aria-label={label}
          title={label}
          aria-current={!archiveView && viewMode === id ? 'page' : undefined}
          onClick={() => {
            onNavigate(id)
            close()
          }}
        >
          <Icon name={icon} />
          <span className="nav-text">{label}</span>
          {id === 'projects' && overdueProjectCount > 0 && (
            <span
              className="nav-overdue-count"
              role="status"
              aria-label={`${overdueProjectCount} ${overdueProjectCount === 1 ? 'proyecto con tareas vencidas' : 'proyectos con tareas vencidas'}`}
            >
              {overdueProjectCount}
            </span>
          )}
        </button>
      ))}
      <div className="nav-divider" />
      <button
        className={`nav-item ${archiveView ? 'active' : ''}`}
        title="Archivados"
        aria-label="Abrir proyectos archivados"
        onClick={() => {
          loadArchived()
          onArchiveView(true)
          close()
        }}
      >
        <Icon name="archive" />
        <span className="nav-text">Archivados</span>
      </button>
    </>
  )
  const accountInfo = (
    <div className="account-info">
      <strong>{currentUser.name}</strong>
      <span>{currentUser.email}</span>
    </div>
  )
  const menu = (
    <>
      {[
        ['edit', 'Editar perfil', onProfile],
        [
          'archive',
          'Archivados',
          () => {
            loadArchived()
            onArchiveView(true)
          },
        ],
        [
          theme === 'dark' ? 'sun' : 'moon',
          theme === 'dark' ? 'Modo claro' : 'Modo oscuro',
          onToggleTheme,
        ],
        ['download', 'Exportar Excel', onExportExcel],
        ['note', 'Generar prompt informe', onExportReportPrompt],
        ['download', 'Descargar backup', onBackup],
        ['upload', 'Importar backup', onRestore],
      ].map(([icon, label, fn]) => (
        <button key={label} onClick={() => action(fn)}>
          <Icon name={icon} />
          {label}
        </button>
      ))}
      <div className="nav-divider" />
      <button className="danger" onClick={() => action(onLogout)}>
        <Icon name="logout" />
        Cerrar sesión
      </button>
    </>
  )
  return (
    <>
      <a className="skip-link" href="#workspace-main">
        Ir al contenido
      </a>
      <aside id="workspace-sidebar" className="sidebar">
        <a
          className="brand-link"
          href="#workspace-main"
          aria-label="Cursor, espacio de trabajo"
        >
          <Brand />
        </a>
        <div className="workspace-picker">
          <span className="workspace-avatar">{currentUser.name[0]}</span>
          <div>
            <strong>Mi espacio de trabajo</strong>
            <span>Organizá lo que viene</span>
          </div>
        </div>
        <span className="nav-label">ESPACIO DE TRABAJO</span>
        <nav aria-label="Vistas principales">{links}</nav>
        <div className="sidebar-footer">
          <span className="sync-dot" />
          Tu trabajo, en un solo lugar
          <span className="version-label">CURSOR / WORKSPACE</span>
        </div>
      </aside>
      <header className="app-topbar ft-header">
        <div className="topbar-context">
          <button className="icon-button sidebar-toggle" aria-controls="workspace-sidebar" aria-expanded={!sidebarCollapsed} aria-label={sidebarCollapsed?'Expandir menú lateral':'Contraer menú lateral'} title={sidebarCollapsed?'Expandir menú lateral':'Contraer menú lateral'} onClick={()=>setSidebarCollapsed(value=>!value)}><Icon name="chevron" style={{transform:sidebarCollapsed?'none':'rotate(180deg)'}}/></button>
          <span className="mobile-brand">
            <Brand />
          </span>
          <span className="desktop-context">
            Mi espacio <Icon name="chevron" size={13} />{' '}
            <strong>
              {archiveView
                ? 'Archivados'
                : views.find((v) => v[0] === viewMode)?.[1]}
            </strong>
          </span>
        </div>
        <div className="topbar-actions">
          <button
            className="icon-button"
            aria-label={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            onClick={onToggleTheme}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
          <div className="account-wrap">
            <button
              className="account-trigger desktop-account"
              aria-label="Menú de usuario"
              aria-expanded={userMenuOpen}
              onClick={() => setUserMenuOpen((v) => !v)}
            >
              <span className="avatar">{currentUser.name[0]}</span>
              <span>{currentUser.name.split(' ')[0]}</span>
              <Icon name="down" size={14} />
            </button>
            {userMenuOpen && (
              <>
                <button
                  className="menu-dismiss"
                  aria-label="Cerrar menú"
                  onClick={close}
                />
                <div className="account-panel">{accountInfo}{menu}</div>
              </>
            )}
          </div>
          <button
            className="icon-button mobile-menu-trigger"
            aria-label="Menú principal"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((v) => !v)}
          >
            <Icon name={mobileMenuOpen ? 'close' : 'menu'} />
          </button>
        </div>
      </header>
      {mobileMenuOpen && (
        <>
          <button
            className="drawer-backdrop"
            aria-label="Cerrar navegación"
            onClick={close}
          />
          <div className="mobile-drawer">
            <nav aria-label="Vistas móviles">{links}</nav>
            <details className="account-panel mobile-account">
              <summary className="mobile-account-trigger">
                {accountInfo}
                <Icon name="down" size={16} />
              </summary>
              {menu}
            </details>
          </div>
        </>
      )}
    </>
  )
}
