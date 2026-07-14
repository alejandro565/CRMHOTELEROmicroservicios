const AppError = require('./AppError');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  // Known operational error
  if (err instanceof AppError) {
    return res.status(err.status).json({
      success: false,
      code: err.code,
      message: err.message,
      ...(Object.keys(err.meta).length ? { meta: err.meta } : {}),
    });
  }

  // Sequelize unique constraint
  if (err.name === 'SequelizeUniqueConstraintError') {
    const field = err.errors?.[0]?.path || 'field';
    return res.status(409).json({
      success: false,
      code: 'DUPLICATE_VALUE',
      message: `Valor duplicado en campo: ${field}`,
    });
  }

  // Sequelize validation error
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: err.errors.map((e) => e.message).join(', '),
    });
  }

  // Unexpected error — don't leak internals in production
  console.error('[ErrorHandler] unhandled error:', err);
  return res.status(500).json({
    success: false,
    code: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production' ? 'Error interno del servidor' : err.message,
  });
}

module.exports = errorHandler;
