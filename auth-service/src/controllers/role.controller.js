const { validationResult } = require('express-validator');
const roleService = require('../services/role.service');
const AppError = require('../middlewares/AppError');

function validate(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Datos inválidos', 400, 'VALIDATION_ERROR', { fields: errors.array() });
  }
}

async function list(req, res, next) {
  try {
    const roles = await roleService.listTenantRoles(req.user.tid);
    res.json({ success: true, data: roles });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const role = await roleService.getRoleById(req.params.id, req.user.tid);
    res.json({ success: true, data: role });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    validate(req);
    const result = await roleService.createRole({
      ...req.body,
      tenant_id: req.user.tid,
    });
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    validate(req);
    const result = await roleService.updateRole(req.params.id, req.body, req.user.tid);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function reassignPermissions(req, res, next) {
  try {
    validate(req);
    const result = await roleService.reassignPermissions(
      req.params.id,
      req.body.permissions,
      req.user.tid
    );
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const result = await roleService.deleteRole(req.params.id, req.user.tid);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, reassignPermissions, remove };
