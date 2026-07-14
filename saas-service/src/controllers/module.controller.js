const { validationResult } = require('express-validator');
const moduleService = require('../services/module.service');
const AppError = require('../middlewares/AppError');

function handleValidation(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Datos inválidos', 400, 'VALIDATION_ERROR', {
      fields: errors.array(),
    });
  }
}

async function create(req, res, next) {
  try {
    handleValidation(req);
    const module_ = await moduleService.registerSystemModule(req.body);
    res.status(201).json({ success: true, data: module_ });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const activeOnly = req.query.active === 'true';
    const modules = await moduleService.listModules({ activeOnly });
    res.json({ success: true, data: modules });
  } catch (err) {
    next(err);
  }
}

async function toggle(req, res, next) {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    if (typeof is_active !== 'boolean') {
      throw new AppError('is_active debe ser boolean', 400, 'VALIDATION_ERROR');
    }
    const module_ = await moduleService.toggleModule(id, is_active);
    res.json({ success: true, data: module_ });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, toggle };
