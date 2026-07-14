const { validationResult } = require('express-validator');
const tenantService = require('../services/tenant.service');
const AppError = require('../middlewares/AppError');

function validate(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Datos inválidos', 400, 'VALIDATION_ERROR', { fields: errors.array() });
  }
}

/**
 * POST /api/tenants/first
 * Owner registers their first hotel (includes plan selection).
 * owner_id and owner_email come from the JWT — never from the body.
 */
async function createFirst(req, res, next) {
  try {
    validate(req);
    const result = await tenantService.createFirstHotel({
      owner_id:    req.user.sub,
      owner_email: req.user.email || req.body.owner_email,
      plan_id:     req.body.plan_id,
      name:        req.body.name,
      tax_id:      req.body.tax_id,
    });
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
}

/**
 * POST /api/tenants
 * Owner adds an additional hotel (plan inherited from existing hotels).
 * owner_id comes from JWT — request body only needs hotel data.
 */
async function create(req, res, next) {
  try {
    validate(req);
    const result = await tenantService.createHotel({
      owner_id:    req.user.sub,
      owner_email: req.user.email || req.body.owner_email,
      name:        req.body.name,
      tax_id:      req.body.tax_id,
    });
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
}

/**
 * GET /api/tenants/mine
 * Returns only the hotels belonging to the authenticated owner.
 */
async function listMine(req, res, next) {
  try {
    const data = await tenantService.listMyHotels(req.user.sub);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function list(req, res, next) {
  try {
    const { status, page, limit } = req.query;
    const result = await tenantService.listTenants({
      status,
      owner_id: req.query.owner_id,
      page:     page  ? parseInt(page)  : 1,
      limit:    limit ? parseInt(limit) : 20,
    });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const tenant = await tenantService.getTenantDetails(req.params.id);
    res.json({ success: true, data: tenant });
  } catch (err) { next(err); }
}

async function suspend(req, res, next) {
  try {
    validate(req);
    const tenant = await tenantService.suspendHotel(req.params.id, req.body.reason);
    res.json({ success: true, data: tenant });
  } catch (err) { next(err); }
}

async function reactivate(req, res, next) {
  try {
    const tenant = await tenantService.reactivateHotel(req.params.id);
    res.json({ success: true, data: tenant });
  } catch (err) { next(err); }
}

async function changePlan(req, res, next) {
  try {
    validate(req);
    const result = await tenantService.updateHotelPlan(req.params.id, req.body.plan_id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function softDelete(req, res, next) {
  try {
    const result = await tenantService.softDeleteHotel(req.params.id, req.user.sub);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    validate(req);
    const result = await tenantService.updateTenant(req.params.id, req.user.sub, req.body);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

module.exports = { createFirst, create, listMine, list, getOne, suspend, reactivate, changePlan, softDelete, update };
