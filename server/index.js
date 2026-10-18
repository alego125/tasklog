require('dotenv').config()
const { createPool, migrate } = require('./db')
const { createApp } = require('./app')
const { jwtSecret } = require('./auth')
async function start() {
  const secret = jwtSecret()
  if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL)
    throw new Error('FRONTEND_URL es requerido en producción')
  const db = createPool()
  db.on('error', (error) => console.error('PostgreSQL pool error:', error.code || error.name))
  try {
    await migrate(db)
    const app = createApp({ db, secret })
    const server = app.listen(process.env.PORT || 3001, () => console.log('TaskLog API lista'))
    async function shutdown() {
      server.close(async () => {
        await db.end()
        process.exit(0)
      })
    }
    process.once('SIGTERM', shutdown)
    process.once('SIGINT', shutdown)
    return { app, server, db }
  } catch (error) {
    await db.end()
    throw error
  }
}
if (require.main === module)
  start().catch((error) => {
    console.error('No se pudo iniciar TaskLog:', error.message)
    process.exitCode = 1
  })
module.exports = { start }
