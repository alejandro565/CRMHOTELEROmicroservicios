const AppError = require('./AppError');

/**
 * Guards /internal/* routes.
 * Expects header: x-internal-token: <AUTH_SERVICE_INTERNAL_TOKEN>
 */
function internalAuth(req, _res, next) {
  if (req.path === '/discovery' || req.path === '/internal/discovery' || req.path.endsWith('/discovery')) {
    return next();
  }

  const token = req.headers['x-internal-token'];
  if (!token || token !== process.env.AUTH_SERVICE_INTERNAL_TOKEN) {
    return next(new AppError('Acceso no autorizado', 401, 'UNAUTHORIZED'));
  }
  next();
}

module.exports = internalAuth;
