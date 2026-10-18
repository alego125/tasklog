const path = require('node:path')
const fs = require('node:fs')
const { createRequire } = require('node:module')
const root = path.resolve(__dirname, '..')
const req = createRequire(path.join(root, 'package.json'))
const { PGlite } = req('@electric-sql/pglite')
const { migrate } = req('./server/db.js')
const { createApp } = req('./server/app.js')
const { randomBytes } = require('node:crypto')
async function main() {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Este comando es solo para pruebas locales')
  fs.mkdirSync(path.join(root, 'data'), { recursive: true })
  const pg = new PGlite(path.join(root, 'data', 'local-preview'))
  let tail = Promise.resolve()
  const acquire = async () => {
    let release
    const next = new Promise((r) => (release = r))
    const previous = tail
    tail = next
    await previous
    return release
  }
  const query = async (sql, params) => {
    if (
      !params &&
      sql
        .trim()
        .split(';')
        .filter((s) => s.trim()).length > 1
    )
      return (await pg.exec(sql)).at(-1)
    const result = await pg.query(sql, params)
    return {
      ...result,
      rows: result.rows.map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([key, value]) => [
            key,
            ['due_date', 'done_at'].includes(key) && value instanceof Date
              ? value.toISOString().slice(0, 10)
              : value,
          ]),
        ),
      ),
    }
  }
  const db = {
    query: async (...args) => {
      const release = await acquire()
      try {
        return await query(...args)
      } finally {
        release()
      }
    },
    connect: async () => {
      const release = await acquire()
      return { query, release }
    },
  }
  await migrate(db)
  const app = createApp({
    db,
    secret: randomBytes(48).toString('hex'),
    frontendUrl: 'http://localhost:5173,http://127.0.0.1:5173',
  })
  const server = app.listen(3001, '127.0.0.1', async () => {
    try {
      const call = async (route, body, token) => {
        const response = await fetch('http://127.0.0.1:3001/api' + route, {
          method: body ? 'POST' : 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: 'Bearer ' + token } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        })
        const data = await response.json()
        if (!response.ok)
          throw new Error(
            data.error || 'No se pudo preparar la cuenta de prueba',
          )
        return data
      }
      let account
      const existing = await db.query(
        'SELECT id FROM users WHERE username=$1',
        ['demo'],
      )
      if (!existing.rows.length) {
        account = await call('/auth/register', {
          name: 'Demo TaskLog',
          username: 'demo',
          email: 'demo@tasklog.local',
          password: 'TasklogDemo2026!',
        })
        const project = await call(
          '/projects',
          { name: 'Mi primer proyecto', color: '#087b60' },
          account.token,
        )
        for (const title of [
          'Explorar la nueva interfaz',
          'Crear una tarea y agregar una nota',
          'Probar la vista semanal',
        ])
          await call(
            '/tasks',
            { project_id: project.id, title, priority: 'media' },
            account.token,
          )
      }
      console.log(
        'API local lista. Abrí http://localhost:5173 · usuario: demo · contraseña inicial: TasklogDemo2026!',
      )
    } catch (error) {
      console.error('No se pudo preparar la demostración:', error.message)
    }
  })
  server.on('error', (error) => {
    console.error('No se pudo iniciar la API local:', error.message)
    pg.close().finally(() => process.exit(1))
  })
  for (const signal of ['SIGTERM', 'SIGINT'])
    process.once(signal, () =>
      server.close(async () => {
        await pg.close()
        process.exit(0)
      }),
    )
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
