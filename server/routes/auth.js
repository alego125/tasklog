const bcrypt = require('bcryptjs')
const { route, fail } = require('../http')
const v = require('../validation')
const { transaction } = require('../db')

// Bounded fixed windows; deploy a shared edge limiter when using multiple replicas.
function loginLimiter({ max = 15, windowMs = 15 * 60 * 1000 } = {}) {
  const windows = new Map()
  return (req, res, next) => {
    const now = Date.now()
    for (const [key, value] of windows) if (value.until <= now) windows.delete(key)
    const key = req.ip
    let value = windows.get(key)
    if (!value) {
      if (windows.size >= 10000)
        return res.status(429).json({ error: 'Demasiados intentos. Intentá más tarde.' })
      value = { until: now + windowMs, count: 0 }
      windows.set(key, value)
    }
    if (++value.count > max) {
      res.setHeader('Retry-After', Math.ceil((value.until - now) / 1000))
      return res.status(429).json({ error: 'Demasiados intentos. Intentá más tarde.' })
    }
    next()
  }
}
module.exports = function authRoutes(app, { db, auth, rateLimit }) {
  const limit = loginLimiter(rateLimit)
  app.post(
    '/api/auth/register',
    limit,
    route(async (req, res) => {
      const { name, username, email, password } = v.credentials(req.body)
      const hash = await bcrypt.hash(password, 12)
      const result = await transaction(db, async (client) => {
        const user = (
          await client.query(
            'INSERT INTO users (name,username,email,password) VALUES ($1,$2,$3,$4) RETURNING id,name,username,email',
            [name, username, email, hash]
          )
        ).rows[0]
        return { user, token: await auth.issue(client, user) }
      })
      res.status(201).json(result)
    })
  )
  app.post(
    '/api/auth/login',
    limit,
    route(async (req, res) => {
      const username = v.text(req.body.username, 'username', 254).toLowerCase()
      const password = req.body.password
      if (typeof password !== 'string' || !password.length || password.length > 1024)
        v.bad('password')
      const user = (await db.query('SELECT * FROM users WHERE username=$1 OR email=$1', [username]))
        .rows[0]
      // Always perform a bcrypt comparison, including unknown users.
      const valid = await bcrypt.compare(
        password,
        user?.password || '$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW'
      )
      if (!user || !valid) fail(401, 'Usuario o contraseña incorrectos')
      const token = await auth.issue(db, user)
      res.json({
        token,
        user: { id: user.id, name: user.name, username: user.username, email: user.email },
      })
    })
  )
  app.get(
    '/api/auth/me',
    auth.requireAuth,
    route(async (req, res) => res.json(req.user))
  )
  app.post(
    '/api/auth/logout',
    auth.requireAuth,
    route(async (req, res) => {
      await db.query('DELETE FROM sessions WHERE id=$1', [req.sessionId])
      res.json({ ok: true })
    })
  )
  app.put(
    '/api/auth/me',
    auth.requireAuth,
    route(async (req, res) => {
      const fields = v.credentials(req.body, { profile: true })
      const result = await transaction(db, async (client) => {
        const existing = (
          await client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE', [req.user.id])
        ).rows[0]
        if (fields.password || fields.email !== existing.email) {
          const current = req.body.current_password
          if (typeof current !== 'string' || !current.length || current.length > 1024)
            v.bad('current_password')
          if (!(await bcrypt.compare(current, existing.password)))
            fail(403, 'La contraseña actual no es correcta')
        }
        const hash = fields.password ? await bcrypt.hash(fields.password, 12) : existing.password
        const user = (
          await client.query(
            'UPDATE users SET name=$1,username=$2,email=$3,password=$4 WHERE id=$5 RETURNING id,name,username,email',
            [fields.name, fields.username, fields.email, hash, req.user.id]
          )
        ).rows[0]
        // Updating identity invalidates every previously issued session.
        await client.query('DELETE FROM sessions WHERE user_id=$1', [user.id])
        return { user, token: await auth.issue(client, user) }
      })
      res.json(result)
    })
  )
}
module.exports.loginLimiter = loginLimiter
