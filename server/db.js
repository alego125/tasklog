const { Pool, types } = require('pg')
const { readFileSync, readdirSync } = require('node:fs')
const path = require('node:path')

// PostgreSQL DATE represents a calendar date, never an instant.
types.setTypeParser(1082, (value) => value)

function poolOptions(env = process.env) {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL es requerido')
  const url = new URL(env.DATABASE_URL)
  if (!['postgres:', 'postgresql:'].includes(url.protocol))
    throw new Error('DATABASE_URL debe ser una URL PostgreSQL')
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (env.DATABASE_SSL === 'disable' && !local)
    throw new Error('Solo se permite desactivar TLS para PostgreSQL local')
  // Avoid pg connection-string options overriding certificate verification.
  for (const key of [
    'ssl',
    'sslmode',
    'sslcert',
    'sslkey',
    'sslrootcert',
    'sslpassword',
    'uselibpqcompat',
  ])
    url.searchParams.delete(key)
  return {
    connectionString: url.toString(),
    ssl:
      local && env.DATABASE_SSL === 'disable'
        ? false
        : {
            rejectUnauthorized: true,
            ...(env.DATABASE_CA_FILE ? { ca: readFileSync(env.DATABASE_CA_FILE, 'utf8') } : {}),
          },
    max: 10,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
  }
}

async function transaction(pool, fn, { readOnly = false } = {}) {
  const client = await pool.connect()
  try {
    await client.query(readOnly ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function migrate(pool) {
  return transaction(pool, async (client) => {
    // Serialize migrations across workers and deployments.
    await client.query('SELECT pg_advisory_xact_lock(74261001)')
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())'
    )
    const applied = new Set(
      (await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name)
    )
    for (const name of readdirSync(path.join(__dirname, 'migrations'))
      .filter((n) => n.endsWith('.sql'))
      .sort()) {
      if (applied.has(name)) continue
      await client.query(readFileSync(path.join(__dirname, 'migrations', name), 'utf8'))
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name])
    }
  })
}

function createPool(env) {
  return new Pool(poolOptions(env))
}
module.exports = { createPool, poolOptions, transaction, migrate }
