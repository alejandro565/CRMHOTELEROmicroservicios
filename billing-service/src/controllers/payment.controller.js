const { validationResult } = require('express-validator');
const svc = require('../services/payment.service');
const AppError = require('../middlewares/AppError');

function validate(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new AppError('Datos inválidos', 400, 'VALIDATION_ERROR', { fields: errors.array() });
}

async function add(req, res, next) {
  try {
    validate(req);
    const data = await svc.addPayment({
      folio_id:          req.params.folioId,
      tenant_id:         req.user.tid,
      user_id:           req.user.sub,
      method:            req.body.method,
      received_currency: req.body.currency || 'BOB',
      received_amount:   req.body.amount,
    });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

async function list(req, res, next) {
  try {
    const data = await svc.listPayments(req.params.folioId, req.user.tid, {
      include_voided: req.query.include_voided === 'true',
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function voidPayment(req, res, next) {
  try {
    validate(req);
    const data = await svc.voidPayment(req.params.id, req.user.tid, req.user.sub, req.body.reason);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function listAll(req, res, next) {
  try {
    const { shift_id, limit } = req.query;
    const data = await svc.listAllPayments(req.user.tid, { shift_id, limit });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

module.exports = { add, list, voidPayment, listAll };
