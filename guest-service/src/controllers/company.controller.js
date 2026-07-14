const { validationResult } = require('express-validator');
const svc = require('../services/company.service');
const AppError = require('../middlewares/AppError');

function validate(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new AppError('Datos inválidos', 400, 'VALIDATION_ERROR', { fields: errors.array() });
}

async function create(req, res, next) {
  try {
    validate(req);
    const data = await svc.createCompany({ ...req.body, tenant_id: req.user.tid });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

async function list(req, res, next) {
  try {
    const data = await svc.listCompanies(req.user.tid, {
      page:  req.query.page  ? parseInt(req.query.page)  : 1,
      limit: req.query.limit ? parseInt(req.query.limit) : 20,
    });
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const data = await svc.getCompany(req.params.id, req.user.tid);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    validate(req);
    const data = await svc.updateCompany(req.params.id, req.user.tid, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const data = await svc.deleteCompany(req.params.id, req.user.tid);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

module.exports = { create, list, getOne, update, remove };
