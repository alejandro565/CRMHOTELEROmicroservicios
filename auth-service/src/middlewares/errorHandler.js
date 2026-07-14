const AppError = require('./AppError');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      success: false,
      error_code: err.code,
      message: err.message,
      ...(Object.keys(err.meta).length ? { meta: err.meta } : {}),
    });
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error_code: 'INVALID_TOKEN',
      message: 'Token inválido o expirado',
    });
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    const field = err.errors?.[0]?.path || 'field';
    return res.status(409).json({
      success: false,
      error_code: 'DUPLICATE_VALUE',
      message: `Valor duplicado en campo: ${field}`,
    });
  }

  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      success: false,
      error_code: 'VALIDATION_ERROR',
      message: err.errors.map((e) => e.message).join(', '),
    });
  }

  console.error('[ErrorHandler] unhandled:', err);
  return res.status(500).json({
    success: false,
    error_code: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production' ? 'Error interno' : err.message,
  });
}

module.exports = errorHandler;
