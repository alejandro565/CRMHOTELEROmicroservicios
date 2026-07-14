const AppError = require('./AppError');

function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ success: false, error_code: err.code, message: err.message });
  }

  console.error('[ErrorHandler]', err);
  return res.status(500).json({
    success: false,
    error_code: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production' ? 'Error interno' : err.message,
  });
}

module.exports = errorHandler;
