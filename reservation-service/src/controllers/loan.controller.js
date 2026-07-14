const { validationResult } = require('express-validator');
const svc = require('../services/loan.service');
const AppError = require('../middlewares/AppError');

function validate(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new AppError('Datos inválidos', 400, 'VALIDATION_ERROR', { fields: errors.array() });
}

async function lend(req, res, next) {
  try {
    validate(req);
    const data = await svc.lendItem({ ...req.body, tenant_id: req.user.tid, lent_by_user_id: req.user.sub });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

async function returnLoan(req, res, next) {
  try {
    const data = await svc.returnItem(req.params.loanId, req.user.tid, req.user.sub);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function markLost(req, res, next) {
  try {
    const data = await svc.markLost(req.params.loanId, req.user.tid, req.user.sub);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function list(req, res, next) {
  try {
    const { status } = req.query;
    const data = await svc.listLoans(req.user.tid, req.params.resRoomId, { status });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

module.exports = { lend, returnLoan, markLost, list };
