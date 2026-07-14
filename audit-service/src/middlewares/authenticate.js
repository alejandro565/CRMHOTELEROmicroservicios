const jwt = require('jsonwebtoken');
const AppError = require('./AppError');
const SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

function authenticate(req, _res, next) {
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError('Token no proporcionado', 401, 'MISSING_TOKEN'));
  }

  try {
    req.user = jwt.verify(header.slice(7), SECRET);
    next();
  } catch {
    next(new AppError('Token inválido', 401, 'INVALID_TOKEN'));
  }
}

module.exports = authenticate;
