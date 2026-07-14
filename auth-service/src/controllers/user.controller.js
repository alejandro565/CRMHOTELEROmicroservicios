const { validationResult } = require('express-validator');
const userService = require('../services/user.service');
const AppError = require('../middlewares/AppError');

function validate(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Datos inválidos', 400, 'VALIDATION_ERROR', { fields: errors.array() });
  }
}

async function create(req, res, next) {
  try {
    validate(req);
    // tenant_id always comes from the authenticated admin's JWT — never from the body
    const user = await userService.createUser({
      ...req.body,
      tenant_id: req.user.tid,
    });
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const { page, limit, active } = req.query;
    const result = await userService.listUsers(req.user.tid, {
      page:   page ? parseInt(page) : 1,
      limit:  limit ? parseInt(limit) : 20,
      active: active !== undefined ? active === 'true' : undefined,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const user = await userService.getUserById(req.params.id, req.user.tid);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

async function updateRole(req, res, next) {
  try {
    validate(req);
    const user = await userService.updateUserRole(req.params.id, req.body.role_id, req.user.tid);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

async function toggleActive(req, res, next) {
  try {
    const { is_active } = req.body;
    if (typeof is_active !== 'boolean') {
      return next(new AppError('is_active debe ser boolean', 400, 'VALIDATION_ERROR'));
    }
    const user = await userService.toggleUserActive(req.params.id, req.user.tid, is_active);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

async function updateSchedule(req, res, next) {
  try {
    validate(req);
    const user = await userService.updateUserSchedule(req.params.id, req.body.work_schedule, req.user.tid);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

// handlers continued below

async function linkTenant(req, res, next) {
  try {
    validate(req);
    const data = await userService.linkUserToTenant({
      email:     req.body.email,
      tenant_id: req.body.tenant_id,
      role_id:   req.body.role_id,
    });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

async function unlinkTenant(req, res, next) {
  try {
    const data = await userService.unlinkUserFromTenant({
      user_id:   req.params.id,
      tenant_id: req.body.tenant_id,
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function listTenants(req, res, next) {
  try {
    const data = await userService.listUserTenants(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

module.exports = { create, list, getOne, updateRole, toggleActive, updateSchedule, linkTenant, unlinkTenant, listTenants };
