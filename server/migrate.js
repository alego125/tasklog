require('dotenv').config()
const { createPool, migrate } = require('./db')
async function main() {
  const db = createPool()
  try {
    await migrate(db)
    console.log('Migraciones aplicadas')
  } finally {
    await db.end()
  }
}
main().catch((error) => {
  console.error('Error de migración:', error.message)
  process.exitCode = 1
})
