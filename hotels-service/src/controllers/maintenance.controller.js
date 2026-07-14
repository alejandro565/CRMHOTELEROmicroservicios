const { validationResult } = require('express-validator');
const svc = require('../services/maintenance.service');
const AppError = require('../middlewares/AppError');

function validate(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new AppError('Datos inválidos', 400, 'VALIDATION_ERROR', { fields: errors.array() });
}

async function reportDamage(req, res, next) {
  try {
    validate(req);
    const data = await svc.reportDamage({
      ...req.body,
      tenant_id:           req.user.tid,
      reported_by_user_id: req.user.sub,
    });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

async function closeIncident(req, res, next) {
  try {
    validate(req);
    const data = await svc.closeMaintenance({
      ...req.body,
      incident_id:         req.params.id,
      tenant_id:           req.user.tid,
      resolved_by_user_id: req.user.sub,
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function listIncidents(req, res, next) {
  try {
    const data = await svc.listOpenIncidents(req.user.tid, req.query.room_id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function listLogs(req, res, next) {
  try {
    const data = await svc.listMaintenanceLogs(req.user.tid, req.query.room_id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

module.exports = { reportDamage, closeIncident, listIncidents, listLogs };
