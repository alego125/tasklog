import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import request from 'supertest'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { createApp } = require('../server/app')
const { migrate, poolOptions } = require('../server/db')
const { jwtSecret } = require('../server/auth')
let pg, db, app, a, b, pa, pb, ta, tb, ca, na, backup, admin, testSchema
const secret = 'test-secret-32-bytes-long-and-private'
const api = (method, path, user) => {
  const r = request(app)[method](path)
  return user ? r.set('Authorization', `Bearer ${user.token}`) : r
}
async function register(username) {
  return (
    await api('post', '/api/auth/register')
      .send({
        name: username,
        username,
        email: `${username}@example.com`,
        password: 'testing-password',
      })
      .expect(201)
  ).body
}
beforeAll(async () => {
  if (process.env.TEST_DATABASE_URL) {
    const { Pool } = require('pg')
    const { randomUUID } = require('node:crypto')
    testSchema = 'tasklog_test_' + randomUUID().replaceAll('-', '')
    admin = new Pool({ connectionString: process.env.TEST_DATABASE_URL })
    await admin.query(`CREATE SCHEMA ${testSchema}`)
    db = new Pool({
      connectionString: process.env.TEST_DATABASE_URL,
      options: `-c search_path=${testSchema},public`,
    })
    pg = {
      exec: (sql) => db.query(sql),
      close: async () => {
        await db.end()
        await admin.query(`DROP SCHEMA ${testSchema} CASCADE`)
        await admin.end()
      },
    }
  } else {
    pg = new PGlite()
    // PGlite embeds the PostgreSQL engine; adapt multi-statement migrations to exec.
    db = {
      query: async (sql, params) =>
        !params &&
        sql
          .trim()
          .split(';')
          .filter((s) => s.trim()).length > 1
          ? (await pg.exec(sql)).at(-1)
          : pg.query(sql, params).then((result) => ({
              ...result,
              rows: result.rows.map((row) =>
                Object.fromEntries(
                  Object.entries(row).map(([key, value]) => [
                    key,
                    ['due_date', 'done_at'].includes(key) && value instanceof Date
                      ? value.toISOString().slice(0, 10)
                      : value,
                  ])
                )
              ),
            })),
      connect: async () => ({ query: (...args) => db.query(...args), release() {} }),
    }
  }
  await migrate(db)
  await migrate(db)
  app = createApp({ db, secret, rateLimit: { max: 1000 } })
  a = await register('alice')
  b = await register('bob')
  pa = (await api('post', '/api/projects', a).send({ name: 'Alice project' }).expect(201)).body
  pb = (await api('post', '/api/projects', b).send({ name: 'Bob project' }).expect(201)).body
  ta = (
    await api('post', '/api/tasks', a)
      .send({ project_id: pa.id, title: 'Alice task', priority: 'alta' })
      .expect(201)
  ).body
  tb = (
    await api('post', '/api/tasks', b).send({ project_id: pb.id, title: 'Bob task' }).expect(201)
  ).body
  ca = (
    await api('post', '/api/comments', b)
      .send({ task_id: tb.id, text: 'Private Bob comment' })
      .expect(201)
  ).body
  na = (
    await api('post', '/api/project-notes', a)
      .send({ project_id: pa.id, text: 'Alice note' })
      .expect(201)
  ).body
})
afterAll(async () => {
  await pg?.close()
})
describe('multi-user isolation and integrity', () => {
  it('blocks moving a comment from an unauthorized source without deleting it', async () => {
    await api('post', `/api/comments/${ca.id}/move-to-project`, a)
      .send({ project_id: pa.id })
      .expect(403)
    expect(
      (await db.query('SELECT text FROM task_comments WHERE id=$1', [ca.id])).rows[0].text
    ).toBe('Private Bob comment')
  })
  it('blocks moving a note into an unauthorized target', async () => {
    await api('post', `/api/project-notes/${na.id}/move-to-task`, a)
      .send({ task_id: tb.id })
      .expect(403)
    expect((await db.query('SELECT id FROM project_notes WHERE id=$1', [na.id])).rows).toHaveLength(
      1
    )
  })
  it('moves authorized notes and preserves author identity', async () => {
    const r = await api('post', `/api/project-notes/${na.id}/move-to-task`, a)
      .send({ task_id: ta.id })
      .expect(200)
    expect(r.body.comment.author_id).toBe(a.user.id)
    expect((await db.query('SELECT id FROM project_notes WHERE id=$1', [na.id])).rows).toHaveLength(
      0
    )
  })
  it('preserves priority on date-only edits and supports explicit clearing', async () => {
    const r = await api('put', `/api/tasks/${ta.id}`, a)
      .send({ due_date: '2026-12-20' })
      .expect(200)
    expect(r.body.priority).toBe('alta')
    expect(r.body.title).toBe('Alice task')
    expect(
      (await api('put', `/api/tasks/${ta.id}`, a).send({ priority: null }).expect(200)).body
        .priority
    ).toBe(null)
    await api('put', `/api/tasks/${ta.id}`, a).send({ priority: 'alta' }).expect(200)
  })
  it('validates inputs, calendar dates and identifiers without leaking database messages', async () => {
    for (const body of [
      { due_date: '2026-02-30' },
      { priority: 'urgent' },
      { title: [] },
      { project_id: -1 },
    ])
      await api('put', `/api/tasks/${ta.id}`, a).send(body).expect(400)
    await api('delete', '/api/tasks/1 OR 1=1', a).expect(400)
    expect(
      (await api('post', '/api/tasks', a).send({ project_id: 99999, title: 'x' }).expect(403)).body
        .error
    ).not.toContain('SELECT')
  })
  it('rolls back project creation when membership insertion fails', async () => {
    const before = (await db.query('SELECT COUNT(*)::int AS n FROM projects')).rows[0].n
    await pg.exec(
      `CREATE FUNCTION reject_member() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF (SELECT name FROM projects WHERE id=NEW.project_id)='rollback-project' THEN RAISE EXCEPTION 'injected failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_member BEFORE INSERT ON project_members FOR EACH ROW EXECUTE FUNCTION reject_member();`
    )
    await api('post', '/api/projects', a).send({ name: 'rollback-project' }).expect(500)
    expect((await db.query('SELECT COUNT(*)::int AS n FROM projects')).rows[0].n).toBe(before)
    await pg.exec('DROP TRIGGER reject_member ON project_members; DROP FUNCTION reject_member();')
  })
  it('paginates without omitting or duplicating projects', async () => {
    await api('post', '/api/projects', a).send({ name: 'Second Alice' }).expect(201)
    const first = (await api('get', '/api/projects?limit=1', a).expect(200)).body
    expect(first.items).toHaveLength(1)
    expect(first.nextCursor).toBeTruthy()
    const second = (
      await api('get', `/api/projects?limit=1&after=${first.nextCursor}`, a).expect(200)
    ).body
    expect(second.items[0].id).not.toBe(first.items[0].id)
    expect(second.nextCursor).toBe(null)
    expect([...first.items, ...second.items].some((p) => p.id === pb.id)).toBe(false)
  })
  it('loads history only on demand while preserving counters and access checks', async () => {
    const page = (await api('get', '/api/projects?history=none', a).expect(200)).body
    const p = page.items.find((p) => p.id === pa.id)
    expect(p.history_loaded).toBe(false)
    expect(p.tasks[0].comments).toHaveLength(0)
    expect(p.tasks[0].comments_count).toBe(1)
    const full = (await api('get', `/api/projects/${pa.id}`, a).expect(200)).body
    expect(full.history_loaded).toBe(true)
    expect(full.tasks[0].comments).toHaveLength(1)
    await api('get', `/api/projects/${pa.id}`, b).expect(403)
  })
  it('does not allow removing the owner or sharing private meeting topics', async () => {
    await api('delete', `/api/projects/${pa.id}/members/${a.user.id}`, a).expect(400)
    const meeting = (await api('post', '/api/meetings', a).send({ name: 'Weekly' }).expect(201))
      .body
    const topic = (
      await api('post', '/api/projects', a)
        .send({ name: 'Topic', meeting_id: meeting.id })
        .expect(201)
    ).body
    await api('post', `/api/projects/${topic.id}/members`, a)
      .send({ user_id: b.user.id })
      .expect(400)
    await api('post', '/api/tasks', a)
      .send({ project_id: topic.id, title: 'Commitment', priority: 'media' })
      .expect(201)
  })
})
describe('safe backup and restore', () => {
  it('exports meetings, memberships and priorities without credentials', async () => {
    await api('post', `/api/projects/${pa.id}/members`, a).send({ user_id: b.user.id }).expect(200)
    backup = (await api('get', '/api/backup', a).expect(200)).body
    expect(backup.version).toBe(2)
    expect(backup.data.meetings).toHaveLength(1)
    expect(backup.data.project_members.some((m) => m.email === b.user.email)).toBe(true)
    expect(backup.data.tasks.find((t) => t.id === ta.id).priority).toBe('alta')
    expect(JSON.stringify(backup)).not.toContain('testing-password')
    expect(backup.data.sessions).toBeUndefined()
  })
  it('rejects malformed and unsupported backups before writing', async () => {
    const before = (await db.query('SELECT COUNT(*)::int AS n FROM projects')).rows[0].n
    for (const payload of [
      { version: 1, data: {} },
      { ...backup, version: 3 },
      {
        ...backup,
        data: { ...backup.data, tasks: [{ ...backup.data.tasks[0], project_id: 99999 }] },
      },
    ])
      await api('post', '/api/restore', a).send(payload).expect(400)
    expect((await db.query('SELECT COUNT(*)::int AS n FROM projects')).rows[0].n).toBe(before)
  })
  it('accepts an empty legacy backup without deleting anything', async () => {
    await api('post', '/api/restore', a)
      .send({ version: 1, data: { projects: [], tasks: [], task_comments: [], project_notes: [] } })
      .expect(200)
    expect((await db.query('SELECT id FROM projects WHERE id=$1', [pb.id])).rows).toHaveLength(1)
  })
  it('restores private copies with new IDs, owners, meeting links and priorities', async () => {
    const originalIds = new Set(backup.data.projects.map((p) => p.id))
    await api('post', '/api/restore', a).send(backup).expect(200)
    const copies = (
      await db.query('SELECT * FROM projects WHERE owner_id=$1', [a.user.id])
    ).rows.filter((p) => !originalIds.has(p.id))
    expect(copies).toHaveLength(backup.data.projects.length)
    const topic = copies.find((p) => p.name === 'Topic')
    expect(topic.meeting_id).not.toBe(backup.data.meetings[0].id)
    const task = (
      await db.query('SELECT * FROM tasks WHERE project_id=$1', [
        copies.find((p) => p.name === 'Alice project').id,
      ])
    ).rows[0]
    expect(task.priority).toBe('alta')
    expect(
      (
        await db.query('SELECT * FROM project_members WHERE project_id=$1', [copies[0].id])
      ).rows.every((m) => m.user_id === a.user.id)
    ).toBe(true)
    expect((await db.query('SELECT name FROM projects WHERE id=$1', [pb.id])).rows[0].name).toBe(
      'Bob project'
    )
  })
  it('restores memberships only when explicitly requested', async () => {
    await api('post', '/api/restore?memberships=true', a).send(backup).expect(200)
    const copies = (
      await db.query("SELECT * FROM projects WHERE name='Alice project' ORDER BY id DESC LIMIT 1")
    ).rows
    expect(
      (
        await db.query('SELECT * FROM project_members WHERE project_id=$1 AND user_id=$2', [
          copies[0].id,
          b.user.id,
        ])
      ).rows
    ).toHaveLength(1)
  })
  it('rolls back every imported row if a later insert fails', async () => {
    const before = (await db.query('SELECT COUNT(*)::int AS n FROM projects')).rows[0].n
    await pg.exec(
      `CREATE FUNCTION reject_task() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$; CREATE TRIGGER reject_task BEFORE INSERT ON tasks FOR EACH ROW EXECUTE FUNCTION reject_task();`
    )
    await api('post', '/api/restore', a).send(backup).expect(500)
    expect((await db.query('SELECT COUNT(*)::int AS n FROM projects')).rows[0].n).toBe(before)
    await pg.exec('DROP TRIGGER reject_task ON tasks; DROP FUNCTION reject_task();')
  })
})
describe('sessions and configuration', () => {
  it('returns a useful 401 for incorrect credentials', async () => {
    expect(
      (
        await api('post', '/api/auth/login')
          .send({ username: 'alice', password: 'wrong' })
          .expect(401)
      ).body.error
    ).toMatch(/contraseña incorrectos/)
  })
  it('invalidates old tokens after a profile/password change', async () => {
    await api('put', '/api/auth/me', a)
      .send({ ...a.user, password: 'new-password-long', current_password: 'wrong' })
      .expect(403)
    const result = await api('put', '/api/auth/me', a)
      .send({ ...a.user, password: 'new-password-long', current_password: 'testing-password' })
      .expect(200)
    await api('get', '/api/auth/me', a).expect(401)
    a = result.body
    await api('get', '/api/auth/me', a).expect(200)
  })
  it('revokes logged-out sessions on the server', async () => {
    await api('post', '/api/auth/logout', a).send({}).expect(200)
    await api('get', '/api/auth/me', a).expect(401)
  })
  it('keeps leading and trailing spaces in valid passwords', async () => {
    const fields = {
      name: 'Spaces',
      username: 'spaces',
      email: 'spaces@example.com',
      password: ' long-password ',
    }
    await api('post', '/api/auth/register').send(fields).expect(201)
    await api('post', '/api/auth/login')
      .send({ username: fields.username, password: fields.password })
      .expect(200)
    await api('post', '/api/auth/login')
      .send({ username: fields.username, password: fields.password.trim() })
      .expect(401)
  })
  it('enforces server-side inactivity', async () => {
    await db.query(
      "UPDATE sessions SET last_seen_at=NOW()-INTERVAL '21 minutes' WHERE user_id=$1",
      [b.user.id]
    )
    await api('get', '/api/auth/me', b).expect(401)
  })
  it('limits repeated authentication attempts', async () => {
    const limited = createApp({ db, secret, rateLimit: { max: 1 } })
    await request(limited)
      .post('/api/auth/login')
      .send({ username: 'missing', password: 'wrong' })
      .expect(401)
    expect(
      (
        await request(limited)
          .post('/api/auth/login')
          .send({ username: 'missing', password: 'wrong' })
          .expect(429)
      ).headers['retry-after']
    ).toBeTruthy()
  })
  it('fails closed on unsafe production config and verifies TLS', () => {
    const secureUrl = poolOptions({
      DATABASE_URL: 'postgresql://u:p@remote.example/db?ssl=false&sslmode=no-verify',
    })
    expect(new URL(secureUrl.connectionString).searchParams.has('ssl')).toBe(false)
    expect(secureUrl.ssl.rejectUnauthorized).toBe(true)
    expect(() => jwtSecret({ NODE_ENV: 'production' })).toThrow(/JWT_SECRET/)
    expect(() =>
      jwtSecret({ NODE_ENV: 'production', JWT_SECRET: 'flowtracker_dev_secret' })
    ).toThrow()
    expect(
      poolOptions({ DATABASE_URL: 'postgresql://u:p@remote.example/db?sslmode=require' }).ssl
        .rejectUnauthorized
    ).toBe(true)
    expect(() =>
      poolOptions({ DATABASE_URL: 'postgresql://u:p@remote.example/db', DATABASE_SSL: 'disable' })
    ).toThrow()
  })
})
