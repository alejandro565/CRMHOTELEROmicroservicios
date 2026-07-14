const { verifyAccessToken } = require('../config/jwt');
const AppError = require('./AppError');

/**
 * Validates the Authorization: Bearer <token> header.
 * On success, attaches the decoded payload to req.user:
 *   { sub, tid, role, feats, perms }
 */
function authenticate(req, _res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError('Token no proporcionado', 401, 'MISSING_TOKEN'));
  }

  try {
    const token = header.slice(7);
    req.user = verifyAccessToken(token);
    next();
  } catch (err) {
    next(err); // JsonWebTokenError / TokenExpiredError → errorHandler
  }
}

/**
 * Factory: checks that req.user.perms includes the required slug.
 * Usage: router.get('/something', authenticate, requirePermission('RESERVATIONS_VIEW'), ctrl)
 */
function requirePermission(slug) {
  return (req, _res, next) => {
    if (!req.user?.perms?.includes(slug)) {
      return next(new AppError('Permiso insuficiente', 403, 'FORBIDDEN'));
    }
    next();
  };
}

/**
 * Guards /internal/* routes.
 * Uses a shared secret header instead of JWT.
 */
function internalAuth(req, _res, next) {
  const token = req.headers['x-internal-token'];
  if (!token || token !== process.env.INTERNAL_TOKEN) {
    return next(new AppError('Acceso interno no autorizado', 401, 'UNAUTHORIZED'));
  }
  next();
}

/**
 * Ensures the acting user belongs to the same tenant as the resource.
 * Reads tenantId from req.params.tenantId or req.body.tenant_id.
 */
function requireSameTenant(req, _res, next) {
  const resourceTenant = req.params.tenantId || req.body.tenant_id;
  if (resourceTenant && resourceTenant !== req.user.tid) {
    return next(new AppError('Acceso denegado a otro tenant', 403, 'CROSS_TENANT_ACCESS'));
  }
  next();
}

module.exports = { authenticate, requirePermission, internalAuth, requireSameTenant };
