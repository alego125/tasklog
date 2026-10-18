const jwt = require('jsonwebtoken')
const { randomBytes, randomUUID } = require('node:crypto')
const { fail } = require('./http')
function jwtSecret(env = process.env) {
  const secret = env.JWT_SECRET
  if (
    secret &&
    Buffer.byteLength(secret.trim()) >= 32 &&
    !secret.includes('flowtracker_dev_secret')
  )
    return secret
  if (env.NODE_ENV === 'production')
    throw new Error('JWT_SECRET debe ser aleatorio y tener al menos 32 bytes')
  // A development restart expires existing sessions instead of using a public key.
  return randomBytes(48).toString('hex')
}
module.exports = function auth(db, secret) {
  async function issue(client, user) {
    const sid = randomUUID()
    await client.query('DELETE FROM sessions WHERE expires_at <= NOW()')
    await client.query(
      "INSERT INTO sessions (id,user_id,expires_at) VALUES ($1,$2,NOW()+INTERVAL '90 minutes')",
      [sid, user.id]
    )
    return jwt.sign({ id: user.id, sid }, secret, {
      algorithm: 'HS256',
      expiresIn: '90m',
      issuer: 'tasklog',
      audience: 'tasklog',
    })
  }
  const authenticate = async (req) => {
    const match = /^Bearer (\S+)$/.exec(req.headers.authorization || '')
    if (!match) fail(401, 'Token requerido')
    let claims
    try {
      claims = jwt.verify(match[1], secret, {
        algorithms: ['HS256'],
        issuer: 'tasklog',
        audience: 'tasklog',
      })
    } catch {
      fail(401, 'Sesión inválida o expirada')
    }
    if (
      !Number.isInteger(claims.id) ||
      typeof claims.sid !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(claims.sid)
    )
      fail(401, 'Sesión inválida')
    const r = await db.query(
      `UPDATE sessions SET last_seen_at=NOW() WHERE id=$1 AND user_id=$2
      AND expires_at>NOW() AND last_seen_at>NOW()-INTERVAL '20 minutes' RETURNING user_id`,
      [claims.sid, claims.id]
    )
    if (!r.rows.length) fail(401, 'Sesión inválida o expirada')
    const user = (
      await db.query('SELECT id,name,username,email FROM users WHERE id=$1', [claims.id])
    ).rows[0]
    if (!user) fail(401, 'Sesión inválida')
    req.user = user
    req.sessionId = claims.sid
  }
  function requireAuth(req, res, next) {
    authenticate(req).then(() => next(), next)
  }
  return { issue, requireAuth }
}
module.exports.jwtSecret = jwtSecret
