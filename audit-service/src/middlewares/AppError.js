class AppError extends Error {
  constructor(message, status = 500, code = 'INTERNAL_ERROR', meta = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.meta = meta;
  }
}

module.exports = AppError;
