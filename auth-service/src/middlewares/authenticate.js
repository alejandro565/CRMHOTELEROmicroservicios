const { verifyAccessToken } = require('../config/jwt');
const { isWithinSchedule } = require('../utils/scheduleValidator');
const AppError = require('./AppError');

/**
 * Validates Authorization: Bearer <token>.
 * Attaches decoded payload to req.user: { sub, tid, role, feats, perms }
 */
function authenticate(req, _res, next) {
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError('Token no proporcionado', 401, 'MISSING_TOKEN'));
  }
  try {
    const decoded = verifyAccessToken(header.slice(7));

    // Enforce work schedule restrictions for non-admin/owner roles
    if (decoded.sched && decoded.role !== 'OWNER' && decoded.role !== 'TENANT_ADMIN') {
      if (!isWithinSchedule(decoded.sched)) {
        return next(new AppError('Acceso denegado: fuera de su horario laboral establecido.', 403, 'OUT_OF_SCHEDULE'));
      }
    }

    req.user = decoded;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Checks that req.user.perms includes the required permission slug.
 */
function requirePermission(slug) {
  return (req, _res, next) => {
    if (!req.user?.perms?.includes(slug)) {
      return next(new AppError(`Permiso requerido: ${slug}`, 403, 'FORBIDDEN'));
    }
    next();
  };
}

/**
 * Checks that req.user.role matches one of the allowed roles.
 * Use this to protect owner-only routes (OWNER_CREATE_HOTEL etc.)
 * without coupling to specific permission slugs.
 *
 * Usage:
 *   router.post('/tenants', authenticate, requireRole('OWNER'), ctrl.createHotel)
 *   router.get('/tenants',  authenticate, requireRole('OWNER', 'SUPER_ADMIN'), ctrl.list)
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

/**
 * Guards /internal/* routes with a shared secret header.
 */
function internalAuth(req, _res, next) {
  if (req.path === '/discovery' || req.path === '/internal/discovery' || req.path.endsWith('/discovery')) {
    return next();
  }

  const token = req.headers['x-internal-token'];
  if (!token || token !== process.env.INTERNAL_TOKEN) {
    return next(new AppError('Acceso interno no autorizado', 401, 'UNAUTHORIZED'));
  }
  next();
}

/**
 * Ensures the acting user belongs to the same tenant as the resource.
 */
function requireSameTenant(req, _res, next) {
  const resourceTenant = req.params.tenantId || req.body.tenant_id;
  if (resourceTenant && resourceTenant !== req.user.tid) {
    return next(new AppError('Acceso denegado a otro tenant', 403, 'CROSS_TENANT_ACCESS'));
  }
  next();
}

module.exports = { authenticate, requirePermission, requireRole, internalAuth, requireSameTenant };
