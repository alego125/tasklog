const { route } = require('../http')
const v = require('../validation')
const { exportBackup, restoreBackup } = require('../backup')
module.exports = function backupRoutes(app, { db, auth }) {
  app.get(
    '/api/backup',
    auth.requireAuth,
    route(async (req, res) => {
      const backup = await exportBackup(db, req.user)
      res.attachment(`tasklog_backup_${new Date().toISOString().slice(0, 10)}.json`).json(backup)
    })
  )
  app.post(
    '/api/restore',
    auth.requireAuth,
    route(async (req, res) => {
      const restoreMemberships =
        req.query.memberships === undefined
          ? false
          : req.query.memberships === 'true'
            ? true
            : req.query.memberships === 'false'
              ? false
              : v.bad('memberships')
      res.json(await restoreBackup(db, req.user, req.body, { restoreMemberships }))
    })
  )
}
