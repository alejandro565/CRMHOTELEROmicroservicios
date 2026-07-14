const { validationResult } = require('express-validator');
const svc = require('../services/shift.service');
const AppError = require('../middlewares/AppError');

function validate(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new AppError('Datos inválidos', 400, 'VALIDATION_ERROR', { fields: errors.array() });
}

async function open(req, res, next) {
  try {
    validate(req);
    const data = await svc.openShift(req.user.tid, req.user.sub, req.body.starting_cash);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

async function status(req, res, next) {
  try {
    const data = await svc.getExpectedCash(req.params.shiftId, req.user.tid);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function currentStatus(req, res, next) {
  try {
    const shift = await svc.getCurrentShift(req.user.tid, req.user.sub);
    const data  = await svc.getExpectedCash(shift.id, req.user.tid);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function close(req, res, next) {
  try {
    validate(req);
    const data = await svc.closeShift(req.params.shiftId, req.user.tid, req.body.actual_cash, req.body.notes);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

module.exports = { open, status, currentStatus, close };
