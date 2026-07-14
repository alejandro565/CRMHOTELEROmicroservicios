class AppError extends Error {
  /**
   * @param {string} message   Human-readable message
   * @param {number} status    HTTP status code
   * @param {string} code      Machine-readable code, e.g. "TAX_ID_DUPLICATE"
   * @param {object} [meta]    Extra context sent in the response body
   */
  constructor(message, status = 500, code = 'INTERNAL_ERROR', meta = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.meta = meta;
  }
}

module.exports = AppError;
