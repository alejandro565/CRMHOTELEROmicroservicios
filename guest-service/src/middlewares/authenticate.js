const jwt = require('jsonwebtoken');
const AppError = require('./AppError');

const SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

function authenticate(req, _res, next) {
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer ')) return next(new AppError('Token no proporcionado', 401, 'MISSING_TOKEN'));
  try {
    req.user = jwt.verify(header.slice(7), SECRET);
    next();
  } catch {
    next(new AppError('Token inválido o expirado', 401, 'INVALID_TOKEN'));
  }
}

function requirePermission(slug) {
  return (req, _res, next) => {
    if (!req.user?.perms?.includes(slug)) return next(new AppError(`Permiso requerido: ${slug}`, 403, 'FORBIDDEN'));
    next();
  };
}

function internalAuth(req, _res, next) {
  if (req.path === '/discovery' || req.path === '/internal/discovery' || req.path.endsWith('/discovery')) {
    return next();
  }

  const token = req.headers['x-internal-token'];
  if (!token || token !== process.env.INTERNAL_TOKEN) return next(new AppError('No autorizado', 401, 'UNAUTHORIZED'));
  next();
}

module.exports = { authenticate, requirePermission, internalAuth };
