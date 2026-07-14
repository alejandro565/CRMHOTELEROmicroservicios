const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

class AppError extends Error {
  constructor(message, status = 500, code = 'INTERNAL_ERROR') {
    super(message); this.name = 'AppError'; this.status = status; this.code = code;
  }
}

function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) return res.status(err.status).json({ success: false, error_code: err.code, message: err.message });
  console.error('[ErrorHandler]', err);
  return res.status(500).json({ success: false, error_code: 'INTERNAL_ERROR', message: process.env.NODE_ENV === 'production' ? 'Error interno' : err.message });
}

function authenticate(req, _res, next) {
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer ')) return next(new AppError('Token no proporcionado', 401, 'MISSING_TOKEN'));
  try { req.user = jwt.verify(header.slice(7), SECRET); next(); }
  catch { next(new AppError('Token inválido', 401, 'INVALID_TOKEN')); }
}

function requirePermission(slug) {
  return (req, _res, next) => {
    if (!req.user?.perms?.includes(slug)) return next(new AppError(`Permiso requerido: ${slug}`, 403, 'FORBIDDEN'));
    next();
  };
}

module.exports = { AppError, errorHandler, authenticate, requirePermission };
