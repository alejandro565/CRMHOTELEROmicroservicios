const { validationResult } = require('express-validator');
const svc = require('../services/charge.service');
const AppError = require('../middlewares/AppError');

function validate(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new AppError('Datos inválidos', 400, 'VALIDATION_ERROR', { fields: errors.array() });
}

async function add(req, res, next) {
  try {
    validate(req);
    const data = await svc.addCharge({ ...req.body, tenant_id: req.user.tid });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

async function list(req, res, next) {
  try {
    const data = await svc.listCharges(req.params.folioId, req.user.tid, {
      include_voided: req.query.include_voided === 'true',
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function voidCharge(req, res, next) {
  try {
    validate(req);
    const data = await svc.voidCharge(req.params.id, req.user.tid, req.user.sub, req.body.reason);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

module.exports = { add, list, voidCharge };
