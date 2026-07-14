const { validationResult } = require('express-validator');
const svc = require('../services/room.service');
const AppError = require('../middlewares/AppError');

function validate(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new AppError('Datos inválidos', 400, 'VALIDATION_ERROR', { fields: errors.array() });
}

async function create(req, res, next) {
  try {
    validate(req);
    const data = await svc.createRoom({ ...req.body, tenant_id: req.user.tid });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

async function massCreate(req, res, next) {
  try {
    validate(req);
    const data = await svc.massCreateRooms({ ...req.body, tenant_id: req.user.tid });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

async function list(req, res, next) {
  try {
    const { status, floor, room_type_id } = req.query;
    const data = await svc.listRooms(req.user.tid, {
      status,
      room_type_id,
      floor: floor !== undefined ? parseInt(floor) : undefined,
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const data = await svc.getRoom(req.params.id, req.user.tid);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    validate(req);
    const data = await svc.updateRoom(req.params.id, req.user.tid, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const data = await svc.deleteRoom(req.params.id, req.user.tid);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function changeStatus(req, res, next) {
  try {
    validate(req);
    const data = await svc.updateRoomStatus(
      req.params.id,
      req.user.tid,
      req.body.status,
      req.user.sub,
    );
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

module.exports = { create, massCreate, list, getOne, update, remove, changeStatus };
