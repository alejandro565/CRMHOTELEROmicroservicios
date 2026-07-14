const AppError = require('./AppError');

function requirePermission(slug) {
  return (req, _res, next) => {
    if (!req.user?.perms?.includes(slug)) {
      return next(new AppError(`Permiso requerido: ${slug}`, 403, 'FORBIDDEN'));
    }
    next();
  };
}

module.exports = requirePermission;
