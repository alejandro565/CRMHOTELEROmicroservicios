const jwt = require('jsonwebtoken');
const AppError = require('./AppError');

const SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

/**
 * Verifies the Authorization: Bearer <token> header.
 * The token is a JWT issued by auth-service — saas-service shares the same secret.
 * Attaches decoded payload to req.user: { sub, tid, role, feats, perms }
 */
function authenticate(req, _res, next) {
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError('Token no proporcionado', 401, 'MISSING_TOKEN'));
  }
  try {
    req.user = jwt.verify(header.slice(7), SECRET);
    next();
  } catch {
    next(new AppError('Token inválido o expirado', 401, 'INVALID_TOKEN'));
  }
}

/**
 * Checks that req.user.role matches one of the allowed roles.
 *
 * Usage:
 *   router.post('/', authenticate, requireRole('OWNER'), ctrl.createHotel)
 */
function requireRole(...roles) {
  return (req, _res, next) => {
    if (!roles.includes(req.user?.role)) {
      return next(new AppError(
        `Se requiere uno de los roles: ${roles.join(', ')}`,
        403,
        'FORBIDDEN_ROLE'
      ));
    }
    next();
  };
}

function requirePermission(permission) {
  return (req, _res, next) => {
    // Si no tiene el arreglo perms o no incluye el permiso que buscamos
    if (!req.user?.perms || !req.user.perms.includes(permission)) {
      return next(new AppError(
        `No tienes el permiso necesario: ${permission}`,
        403,
        'FORBIDDEN_PERMISSION'
      ));
    }
    next();
  };
}

module.exports = { authenticate, requireRole, requirePermission };
