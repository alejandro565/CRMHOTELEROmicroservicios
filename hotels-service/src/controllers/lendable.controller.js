const { validationResult } = require('express-validator');
const svc = require('../services/lendable.service');
const AppError = require('../middlewares/AppError');

function validate(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new AppError('Datos inválidos', 400, 'VALIDATION_ERROR', { fields: errors.array() });
}

async function create(req, res, next) {
  try {
    validate(req);
    const data = await svc.createLendableItem({ ...req.body, tenant_id: req.user.tid });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

async function list(req, res, next) {
  try {
    const data = await svc.listLendableItems(req.user.tid);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const data = await svc.getLendableItem(req.params.id, req.user.tid);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    validate(req);
    const data = await svc.updateLendableItem(req.params.id, req.user.tid, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const data = await svc.deleteLendableItem(req.params.id, req.user.tid);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

module.exports = { create, list, getOne, update, remove };
