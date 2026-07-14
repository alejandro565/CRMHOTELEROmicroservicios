const { validationResult } = require('express-validator');
const svc = require('../services/invoice.service');
const AppError = require('../middlewares/AppError');

function validate(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new AppError('Datos inválidos', 400, 'VALIDATION_ERROR', { fields: errors.array() });
}

async function generate(req, res, next) {
  try {
    validate(req);
    const data = await svc.generateInvoice({ ...req.body, folio_id: req.params.folioId, tenant_id: req.user.tid });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

async function list(req, res, next) {
  try {
    const data = await svc.listInvoices(req.user.tid, req.query.folio_id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

module.exports = { generate, list };
