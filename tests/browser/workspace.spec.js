import { test, expect } from '@playwright/test'
const alice = {
  id: 1,
  name: 'Alice',
  username: 'alice',
  email: 'alice@example.com',
}
const bob = { id: 2, name: 'Bob', username: 'bob', email: 'bob@example.com' }
const project = (user) => ({
  id: user.id,
  name: `${user.name} private project`,
  color: '#7a9e7e',
  owner_id: user.id,
  members: [{ ...user, role: 'owner' }],
  created_at: '2026-10-16T12:00:00Z',
  notes: [],
  tasks: [
    {
      id: user.id,
      project_id: user.id,
      title: `${user.name} task`,
      priority: 'alta',
      done: false,
      due_date: '2026-12-20',
      comments: [],
      created_at: '2026-10-16T12:00:00Z',
    },
  ],
})
async function mockApi(page) {
  await page.route('**/api/**', async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname
    const user =
      req.headers().authorization === 'Bearer bob-token' ? bob : alice
    const data = req.postDataJSON()
    let body
    if (path === '/api/auth/login') {
      if (data.password === 'wrong')
        return route.fulfill({
          status: 401,
          json: { error: 'Usuario o contraseña incorrectos' },
        })
      const u = data.username === 'bob' ? bob : alice
      body = { user: u, token: `${u.username}-token` }
    } else if (path === '/api/auth/me') body = user
    else if (path === '/api/auth/logout') body = { ok: true }
    else if (/^\/api\/projects\/\d+$/.test(path)) body = project(user)
    else if (path === '/api/projects')
      body = { items: [project(user)], nextCursor: null }
    else if (path === '/api/projects/archived')
      body = {
        items: [
          {
            ...project(user),
            name: `${user.name} archived project`,
            archived: true,
          },
        ],
        nextCursor: null,
      }
    else if (path.startsWith('/api/meetings'))
      body = { items: [], nextCursor: null }
    else if (path === '/api/restore')
      body = {
        ok: true,
        restored: { projects: 1, meetings: 0, tasks: 1 },
        warnings: { legacy: false, missingMembers: [] },
      }
    else body = { ok: true }
    await route.fulfill({ json: body })
  })
}
async function login(page, name = 'alice', password = 'testing-password') {
  await page.getByLabel('Usuario', { exact: true }).fill(name)
  await page.getByLabel('Contraseña', { exact: true }).fill(password)
  await page
    .getByRole('button', { name: 'Iniciar sesión', exact: true })
    .last()
    .click()
}
test('login errors, keyboard controls, focus handling and account isolation', async ({
  page,
}) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await mockApi(page)
  await page.goto('/')
  await login(page, 'alice', 'wrong')
  await expect(page.getByRole('alert')).toContainText(
    'Usuario o contraseña incorrectos',
  )
  await login(page)
  await expect(
    page.getByRole('button', { name: 'Alice private project', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Alice private project', exact: true })
    .press('Enter')
  const checkbox = page.getByRole('checkbox', { name: 'Completar Alice task' })
  await expect(checkbox).toBeVisible()
  await checkbox.focus()
  await expect(checkbox).toBeFocused()
  const menu = page.getByRole('button', { name: 'Menú de usuario' })
  await menu.click()
  await page.getByRole('button', { name: 'Editar perfil' }).click()
  await expect(
    page.getByRole('dialog', { name: 'Editar perfil' }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(menu).toBeFocused()
  await menu.click()
  await page
    .getByRole('banner')
    .getByRole('button', { name: 'Archivados', exact: true })
    .click()
  await expect(page.getByText('Alice archived project')).toBeVisible()
  await menu.click()
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await login(page, 'bob')
  await expect(
    page.getByRole('button', { name: 'Bob private project', exact: true }),
  ).toBeVisible()
  await expect(page.getByText('Alice archived project')).toHaveCount(0)
  await expect(page.getByText('Alice private project')).toHaveCount(0)
  expect(errors).toEqual([])
})
test('backup import preview and safe copy result', async ({ page }) => {
  await mockApi(page)
  await page.goto('/')
  await login(page)
  await page.getByRole('button', { name: 'Menú de usuario' }).click()
  await page.getByRole('button', { name: 'Importar backup' }).click()
  const dialog = page.getByRole('dialog', { name: 'Importar backup' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Archivo JSON').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({ version: 2, data: { projects: [project(alice)] } }),
    ),
  })
  await expect(dialog.getByText('1 proyectos en el archivo')).toBeVisible()
  await dialog.getByRole('button', { name: 'Importar como copias' }).click()
  await expect(dialog.getByRole('status')).toContainText(
    'Se importaron 1 proyectos',
  )
  await dialog.getByRole('button', { name: 'Finalizar' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
test('mobile layout keeps menus and dialogs usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockApi(page)
  await page.goto('/')
  await login(page)
  await page.getByRole('button', { name: 'Menú principal' }).click()
  const account = page.locator('.mobile-account')
  const trigger = account.locator('summary')
  await expect(account).not.toHaveAttribute('open', '')
  await expect(page.getByRole('button', { name: 'Importar backup' })).toBeHidden()
  await trigger.click()
  await expect(page.getByRole('button', { name: 'Editar perfil' })).toBeVisible()
  await trigger.click()
  await expect(page.getByRole('button', { name: 'Editar perfil' })).toBeHidden()
  await trigger.focus()
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Importar backup' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})

test('project menus support keyboard editing and filters stay discoverable', async ({
  page,
}) => {
  await mockApi(page)
  await page.goto('/')
  await login(page)
  const actions = page.getByRole('button', {
    name: 'Acciones de Alice private project',
    exact: true,
  })
  await actions.click()
  await expect(
    page.getByRole('menuitem', { name: 'Gestionar miembros', exact: true }),
  ).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(
    page.getByRole('menuitem', { name: 'Descargar contenido para IA' }),
  ).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(actions).toBeFocused()
  await actions.click()
  await page.getByRole('menuitem', { name: 'Editar proyecto' }).click()
  await expect(
    page.getByRole('dialog', { name: 'Editar proyecto' }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(actions).toBeFocused()
  const filters = page.getByRole('button', { name: 'Filtros', exact: true })
  await expect(filters).toHaveAttribute('aria-expanded', 'false')
  await filters.click()
  await expect(page.getByLabel('Desde', { exact: true })).toBeVisible()
  await page
    .getByRole('navigation', { name: 'Vistas principales' })
    .getByRole('button', { name: 'Dashboard', exact: true })
    .click()
  await expect(
    page.getByText('Estado de tareas por proyecto', { exact: true }),
  ).toBeVisible()
  await expect(page.getByLabel('Desde', { exact: true })).toHaveCount(0)
})

test('320px navigation, project visibility and centered dialogs', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await mockApi(page)
  await page.goto('/')
  await login(page)
  const card = page.getByRole('button', {
    name: 'Alice private project',
    exact: true,
  })
  await expect(card).toBeVisible()
  expect((await card.boundingBox()).y).toBeLessThan(500)
  await page.getByRole('button', { name: 'Menú principal' }).click()
  await page
    .getByRole('navigation', { name: 'Vistas móviles' })
    .getByRole('button', { name: 'Semana', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Configurar tarjeta', exact: true }),
  ).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  )
  const column = await page.locator('.ft-kanban-col').first().boundingBox()
  expect(column.width).toBeLessThanOrEqual((await page.locator('#workspace-main').boundingBox()).width)
  await page.getByRole('button', { name: 'Menú principal' }).click()
  await page.locator('.mobile-account summary').click()
  await page
    .getByRole('button', { name: 'Importar backup', exact: true })
    .click()
  const dialog = await page
    .getByRole('dialog', { name: 'Importar backup' })
    .boundingBox()
  expect(Math.abs(dialog.x + dialog.width / 2 - 160)).toBeLessThan(2)
  expect(Math.abs(dialog.y + dialog.height / 2 - 360)).toBeLessThan(2)
})

test('expand all remains open after loading history and can be toggled repeatedly', async ({ page }) => {
  await mockApi(page)
  await page.goto('/')
  await login(page)
  const task = page.getByRole('checkbox', { name: 'Completar Alice task' })
  const title = page.getByRole('button', { name: 'Alice private project', exact: true })
  await expect(title).toHaveAttribute('aria-expanded', 'false')
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Expandir todos', exact: false }).click()
    await expect(task).toBeVisible()
    await expect(title).toHaveAttribute('aria-expanded', 'true')
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await expect(task).toBeVisible()
    await page.getByRole('button', { name: 'Colapsar todos', exact: false }).click()
    await expect(task).toHaveCount(0)
    await expect(title).toHaveAttribute('aria-expanded', 'false')
  }
  await title.click()
  await expect(task).toBeVisible()
  await page.getByRole('button', { name: 'Colapsar todos', exact: false }).click()
  await expect(task).toHaveCount(0)
})

test('sidebar starts collapsed, stays usable and resets on reload', async ({ page }) => {
  await mockApi(page)
  await page.goto('/')
  await login(page)
  const sidebar = page.locator('#workspace-sidebar')
  const main = page.locator('#workspace-main')
  await expect(page.getByRole('button', { name: 'Expandir menú lateral', exact: true })).toHaveAttribute('aria-expanded', 'false')
  expect((await sidebar.boundingBox()).width).toBe(76)
  await page.getByRole('button', { name: 'Expandir menú lateral', exact: true }).click()
  expect((await sidebar.boundingBox()).width).toBeGreaterThan(76)
  const before = (await main.boundingBox()).x
  await page.getByRole('button', { name: 'Contraer menú lateral', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Expandir menú lateral', exact: true })).toHaveAttribute('aria-expanded', 'false')
  expect((await sidebar.boundingBox()).width).toBe(76)
  expect((await main.boundingBox()).x).toBeLessThan(before)
  await sidebar.getByRole('button', { name: 'Tareas', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Tus tareas', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Expandir menú lateral', exact: true }).click()
  await page.evaluate(() => localStorage.setItem('cursor_sidebar_collapsed', 'false'))
  await page.reload()
  await expect(page.getByRole('button', { name: 'Expandir menú lateral', exact: true })).toBeVisible()
  expect((await sidebar.boundingBox()).width).toBe(76)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(sidebar).toBeHidden()
  expect((await main.boundingBox()).x).toBe(0)
  await page.getByRole('button', { name: 'Menú principal' }).click()
  await expect(page.getByRole('navigation', { name: 'Vistas móviles' }).getByRole('button', { name: 'Tareas', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Menú principal' }).click()
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.getByRole('button', { name: 'Expandir menú lateral', exact: true }).click()
  expect((await sidebar.boundingBox()).width).toBeGreaterThan(76)
})

test('note creation stays visible next to task creation on desktop and mobile', async ({ page }) => {
  await mockApi(page)
  await page.goto('/')
  await login(page)
  const note = page.getByRole('button', { name: 'Agregar nota a Alice private project', exact: true })
  const task = page.getByRole('button', { name: 'Agregar tarea a Alice private project', exact: true })
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    await expect(note).toBeVisible()
    await expect(task).toBeVisible()
    await expect(note).toHaveText(/Nota/)
    await expect(task).toHaveText(/Tarea/)
    await note.click()
    await expect(note).toHaveAttribute('aria-expanded', 'true')
    const input = page.getByRole('textbox', { name: 'Nueva nota para Alice private project' })
    await expect(input).toBeFocused()
    await input.fill('Nota de seguimiento')
    await page.locator('.project-note-form').getByRole('button', { name: 'Cancelar', exact: true }).click()
    await expect(input).toHaveCount(0)
    await expect(note).toHaveAttribute('aria-expanded', 'false')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await note.click()
  const saved = page.waitForRequest(r => r.method() === 'POST' && new URL(r.url()).pathname === '/api/project-notes')
  await page.locator('.project-note-form').getByRole('button', { name: 'Agregar', exact: true }).click()
  expect((await saved).postDataJSON()).toMatchObject({ project_id: 1, text: 'Nota de seguimiento' })
})

test('deadline colors stay independent inside projects, tasks and meetings in both themes', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ft_theme', 'light'))
  await page.clock.setFixedTime(new Date('2026-10-17T15:00:00Z'))
  await mockApi(page)
  const richProject = {
    ...project(alice),
    history_loaded: true,
    notes_count: 1,
    notes: [{ id: 20, project_id: 1, author: 'Alice', text: 'Nota neutral del proyecto', created_at: '2026-10-16T12:00:00Z' }],
    tasks: [
      { ...project(alice).tasks[0], id: 1, title: 'Tarea vencida', due_date: '2026-10-15', comments_count: 1, comments: [{ id: 30, task_id: 1, author: 'Alice', text: 'Nota neutral de tarea', created_at: '2026-10-16T12:00:00Z' }] },
      { ...project(alice).tasks[0], id: 2, title: 'Tarea por vencer', due_date: '2026-10-18' },
      { ...project(alice).tasks[0], id: 3, title: 'Tarea a tiempo', due_date: '2026-11-20' },
      { ...project(alice).tasks[0], id: 4, title: 'Tarea completada', due_date: '2026-10-15', done: true },
      { ...project(alice).tasks[0], id: 5, title: 'Tarea sin fecha', due_date: null },
    ],
  }
  await page.route('**/api/projects**', async route => {
    const path = new URL(route.request().url()).pathname
    await route.fulfill({ json: /^\/api\/projects\/\d+$/.test(path) ? richProject : { items: [richProject], nextCursor: null } })
  })
  await page.route('**/api/meetings**', route => route.fulfill({ json: { items: [{ id: 1, name: 'Reunión de prueba', owner_id: 1, color: '#7a9e7e', archived: false, temas_count: 1, tasks_pending: 4, tasks_done: 1, notes_count: 1, created_at: '2026-10-16T12:00:00Z' }], nextCursor: null } }))
  await page.goto('/')
  await login(page)
  const tokenColor = token => page.evaluate(name => {
    const element = document.createElement('div')
    element.style.backgroundColor = `var(${name})`
    document.body.append(element)
    const color = getComputedStyle(element).backgroundColor
    element.remove()
    return color
  }, token)
  const checkRows = async () => {
    for (const [id, status, token] of [[1, 'overdue', '--task-overdue-bg'], [2, 'warning', '--task-warning-bg'], [3, 'ok', '--bg-surface'], [4, 'done', '--bg-surface'], [5, 'ok', '--bg-surface']]) {
      await expect(page.locator(`#task-${id}`)).toHaveAttribute('data-status', status)
      await expect(page.locator(`#task-${id}`)).toHaveCSS('background-color', await tokenColor(token))
      if (status === 'overdue' || status === 'warning') {
        await expect(page.locator(`#task-${id} .task-title`)).toHaveCSS('color', await tokenColor(status === 'overdue' ? '--task-overdue-ink' : '--task-warning-ink'))
      }
    }
  }
  const checkProject = async () => {
    const title = page.getByRole('button', { name: richProject.name, exact: true })
    await expect(async () => {
      if (await title.getAttribute('aria-expanded') !== 'true') await title.click()
      await expect(page.locator('#task-1')).toHaveCount(1, { timeout: 500 })
    }).toPass({ timeout: 5000 })
    await expect(page.locator('#project-1')).toHaveAttribute('data-alert', 'overdue')
    await expect(page.locator('#project-1')).toHaveCSS('background-color', await tokenColor('--status-overdue-bg'))
    await expect(page.locator('.project-title-row .project-deadline-count.overdue')).toHaveText('1 vencida')
    await expect(page.locator('.project-title-row .project-deadline-count.warning')).toHaveText('1 por vencer')
    await checkRows()
    await expect(page.locator('.project-note-row')).toHaveCSS('background-color', await tokenColor('--bg-surface'))
  }
  const nav = page.getByRole('navigation', { name: 'Vistas principales' })
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await page.getByRole('button', { name: 'Modo oscuro', exact: true }).click()
    await nav.getByRole('button', { name: 'Proyectos', exact: true }).click()
    await checkProject()
    const taskTitle = page.getByRole('button', { name: 'Tarea vencida', exact: true })
    if (await taskTitle.getAttribute('aria-expanded') !== 'true') await taskTitle.click()
    await expect(page.locator('.ft-task-comments')).toHaveCSS('background-color', await tokenColor('--bg-surface'))
    await expect(page.locator('.comment-card')).toHaveCSS('background-color', await tokenColor('--bg-surface'))
    await checkRows()
    await nav.getByRole('button', { name: 'Tareas', exact: true }).click()
    await checkRows()
    await nav.getByRole('button', { name: 'Reuniones', exact: true }).click()
    await page.getByRole('button', { name: 'Abrir', exact: true }).click()
    await checkProject()
  }
})

test('mobile task metadata stays visible and wraps without clipping', async ({ page }) => {
  await mockApi(page)
  const richProject = project(alice)
  richProject.tasks[0].title = 'Revisar toda la documentación del proyecto antes de la entrega final'
  richProject.tasks[0].responsible = 'ResponsableConUnNombreMuyLargoSinEspacios'
  await page.route('**/api/projects**', route => route.fulfill({ json: /\/projects\/\d+$/.test(new URL(route.request().url()).pathname) ? richProject : { items: [richProject], nextCursor: null } }))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await login(page)
  await page.getByRole('button', { name: richProject.name, exact: true }).click()
  const check = async () => {
    for (const width of [320, 390, 600]) {
      await page.setViewportSize({ width, height: 844 })
      const task = page.locator('#task-1')
      await expect(task.locator('.registration-date')).toBeVisible()
      await expect(task.locator('.registration-date')).toContainText('Registro:16/10/2026 09:00')
      await expect(task.getByTitle('Editar vencimiento', { exact: true })).toContainText('Vencimiento:20/12/2026')
      await expect(task.getByText(richProject.tasks[0].responsible, { exact: true })).toBeVisible()
      await expect(task.getByRole('button', { name: 'Expandir bitácora', exact: true })).toBeVisible()
      expect(await task.evaluate(el => Array.from(el.querySelectorAll('.ft-task-meta, .ft-task-meta > *, .task-title')).every(node => node.scrollWidth <= node.clientWidth + 1))).toBe(true)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
  }
  await check()
  await page.getByRole('button', { name: 'Menú principal' }).click()
  await page.getByRole('navigation', { name: 'Vistas móviles' }).getByRole('button', { name: 'Tareas', exact: true }).click()
  await check()
})

test('navigation counts projects with overdue pending tasks and hides zero', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-17T15:00:00Z'))
  await mockApi(page)
  let overdue = true
  await page.route('**/api/projects**', route => {
    const item = project(alice)
    item.tasks = [
      { ...item.tasks[0], due_date: '2026-10-15', done: !overdue },
      { ...item.tasks[0], id: 2, due_date: '2026-10-14', done: !overdue },
    ]
    return route.fulfill({ json: { items: [item, { ...project(bob), tasks: [{ ...project(bob).tasks[0], due_date: '2026-10-15', done: true }] }], nextCursor: null } })
  })
  await page.goto('/')
  await login(page)
  const count = page.locator('#workspace-sidebar .nav-overdue-count')
  await expect(count).toHaveText('1')
  await expect(count).toBeVisible()
  await expect(count).toHaveAttribute('aria-label', '1 proyecto con tareas vencidas')
  await page.getByRole('button', { name: 'Expandir menú lateral', exact: true }).click()
  await expect(count).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Menú principal' }).click()
  await expect(page.locator('.mobile-drawer .nav-overdue-count')).toHaveText('1')
  overdue = false
  await page.reload()
  await page.getByRole('button', { name: 'Menú principal' }).click()
  await expect(page.locator('.nav-overdue-count')).toHaveCount(0)
})
