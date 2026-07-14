const { validationResult } = require('express-validator');
const svc = require('../services/lendable.service');
const AppError = require('../middlewares/AppError');

function validate(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new AppError('Datos inválidos', 400, 'VALIDATION_ERROR', { fields: errors.array() });
}

async function adjust(req, res, next) {
  try {
    validate(req);
    const { qty, reason } = req.body;
    const data = await svc.adjustInventory(req.params.itemId, req.user.tid, qty, reason);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

module.exports = { adjust };
