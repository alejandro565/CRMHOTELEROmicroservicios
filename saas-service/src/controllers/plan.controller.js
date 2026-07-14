const { validationResult } = require('express-validator');
const planService = require('../services/plan.service');
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
    const plan = await planService.definePlan(req.body);
    res.status(201).json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const activeOnly = req.query.active === 'true';
    const plans = await planService.listPlans({ activeOnly });
    res.json({ success: true, data: plans });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const plan = await planService.getPlanById(req.params.id);
    res.json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, getOne };
