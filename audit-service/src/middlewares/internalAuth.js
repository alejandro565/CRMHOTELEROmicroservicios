const AppError = require('./AppError');

function internalAuth(req, _res, next) {
  if (req.path === '/discovery' || req.path === '/internal/discovery' || req.path.endsWith('/discovery')) {
    return next();
  }

  const token = req.headers['x-internal-token'];
  if (!token || token !== process.env.INTERNAL_TOKEN) {
    return next(new AppError('No autorizado', 401, 'UNAUTHORIZED'));
  }
  next();
}

module.exports = internalAuth;
