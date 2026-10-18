class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}
const route = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)
const fail = (status, message) => {
  throw new HttpError(status, message)
}
const denied = () => fail(403, 'No tenés permiso para realizar esta acción')
function errorHandler(error, req, res, _next) {
  const status =
    error.status ||
    { 23505: 409, 23503: 400, '22P02': 400, 22007: 400, 22008: 400 }[error.code] ||
    500
  if (status >= 500) console.error('API error:', error.code || error.name)
  const message =
    status >= 500
      ? 'No se pudo completar la operación'
      : error.code === '23505'
        ? 'El usuario o email ya está en uso'
        : error.code
          ? 'Datos inválidos o referencias inexistentes'
          : error.type === 'entity.too.large'
            ? 'El archivo supera el límite de 10 MB'
            : error.type === 'entity.parse.failed'
              ? 'JSON inválido'
              : error.message
  res.status(status).json({ error: message })
}
module.exports = { HttpError, route, fail, denied, errorHandler }
