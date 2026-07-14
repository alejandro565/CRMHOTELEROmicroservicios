const { validationResult } = require('express-validator');
const svc = require('../services/frontoffice.service');
const AppError = require('../middlewares/AppError');

function validate(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new AppError('Datos inválidos', 400, 'VALIDATION_ERROR', { fields: errors.array() });
}

async function assign(req, res, next) {
  try {
    validate(req);
    const data = await svc.assignPhysicalRoom(req.params.resRoomId, req.user.tid, req.body.room_id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

const resSvc = require('../services/reservation.service');

async function relocate(req, res, next) {
  try {
    const data = await resSvc.relocateRoom(req.params.resRoomId, req.user.tid, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function checkIn(req, res, next) {
  try {
    const data = await svc.processCheckIn(req.params.id, req.user.tid);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function checkOut(req, res, next) {
  try {
    const data = await svc.processCheckOut(req.params.id, req.user.tid);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

module.exports = { assign, relocate, checkIn, checkOut };
