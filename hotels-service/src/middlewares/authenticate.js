const jwt = require('jsonwebtoken');
const AppError = require('./AppError');
const { Room, HotelSettings } = require('../models');

const SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

/**
 * Verifies the JWT and attaches the decoded payload to req.user.
 * All downstream middlewares and services rely on req.user.tid for isolation.
 */
function authenticate(req, _res, next) {
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError('Token no proporcionado', 401, 'MISSING_TOKEN'));
  }
  try {
    req.user = jwt.verify(header.slice(7), SECRET);
    next();
  } catch (err) {
    next(new AppError('Token inválido o expirado', 401, 'INVALID_TOKEN'));
  }
}

/**
 * Factory: checks that req.user.perms includes the required slug.
 * Usage: requirePermission('HOTELS_CONFIG')
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
 * Guards /internal/* routes using the shared service token.
 */
function internalAuth(req, _res, next) {
  // Omitir validación de token interno para el autodescubrimiento
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
 * Plan limit guard for room creation.
 * Reads plan_max_rooms from hotel_settings and compares with current room count.
 * Attach AFTER authenticate so req.user.tid is available.
 */
async function enforcePlanRoomLimit(req, _res, next) {
  try {
    const tenantId = req.user.tid;
    const settings = await HotelSettings.findOne({ where: { tenant_id: tenantId } });

    // 0 = unlimited
    if (!settings || settings.plan_max_rooms === 0) return next();

    const currentCount = await Room.count({ where: { tenant_id: tenantId } });

    // For mass creation, req.body.count tells us how many will be added
    const adding = req.body.count || 1;

    if (currentCount + adding > settings.plan_max_rooms) {
      return next(new AppError(
        `Límite de habitaciones del plan alcanzado (${settings.plan_max_rooms} máx.)`,
        403,
        'PLAN_ROOM_LIMIT_EXCEEDED',
        { current: currentCount, limit: settings.plan_max_rooms, trying_to_add: adding }
      ));
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { authenticate, requirePermission, internalAuth, enforcePlanRoomLimit };
