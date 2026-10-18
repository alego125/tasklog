const express = require('express')
const cors = require('cors')
const authFactory = require('./auth')
const createStore = require('./projects-store')
const { errorHandler, route } = require('./http')
function createApp({
  db,
  secret = authFactory.jwtSecret(),
  frontendUrl = process.env.FRONTEND_URL,
  rateLimit,
} = {}) {
  if (!db) throw new Error('Database is required')
  const app = express()
  const hops = Number(process.env.TRUST_PROXY_HOPS || 0)
  if (!Number.isInteger(hops) || hops < 0 || hops > 2) throw new Error('TRUST_PROXY_HOPS inválido')
  app.set('trust proxy', hops)
  app.disable('x-powered-by')
  app.use(
    cors({
      origin: frontendUrl
        ? frontendUrl.split(',').map((s) => s.trim())
        : process.env.NODE_ENV === 'production'
          ? false
          : ['http://localhost:5173', 'http://localhost:4173'],
    })
  )
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cache-Control', 'no-store')
    next()
  })
  app.use(express.json({ limit: '10mb' }))
  app.use((req, res, next) => {
    if (
      ['POST', 'PUT', 'PATCH'].includes(req.method) &&
      (!req.body || Array.isArray(req.body) || typeof req.body !== 'object')
    )
      return res.status(400).json({ error: 'Se requiere un objeto JSON' })
    next()
  })
  app.get(
    '/api/health',
    route(async (_req, res) => {
      await db.query('SELECT 1')
      res.json({ status: 'ok' })
    })
  )
  const context = { db, auth: authFactory(db, secret), store: createStore(db), rateLimit }
  for (const name of ['auth', 'projects', 'meetings', 'tasks', 'notes', 'backup'])
    require(`./routes/${name}`)(app, context)
  app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }))
  app.use(errorHandler)
  return app
}
module.exports = { createApp }
