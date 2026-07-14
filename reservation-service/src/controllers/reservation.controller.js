const { validationResult } = require('express-validator');
const svc = require('../services/reservation.service');
const AppError = require('../middlewares/AppError');

function validate(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error('[Validation Error]', JSON.stringify(errors.array(), null, 2));
    throw new AppError('Datos inválidos', 400, 'VALIDATION_ERROR', { fields: errors.array() });
  }
}

const notifySvc = require('../services/notification.service');

async function create(req, res, next) {
  try {
    console.log('[Reservation Create Payload]', JSON.stringify(req.body, null, 2));
    validate(req);
    const data = await svc.createReservation({ ...req.body, tenant_id: req.user.tid });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

async function list(req, res, next) {
  try {
    const { status, date, page, limit } = req.query;
    const data = await svc.listReservations(req.user.tid, {
      status,
      date,
      page:  page  ? parseInt(page)  : 1,
      limit: limit ? parseInt(limit) : 20,
    });
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const data = await svc.getReservation(req.params.id, req.user.tid);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function edit(req, res, next) {
  try {
    validate(req);
    const data = await svc.editReservation(req.params.id, req.user.tid, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function cancel(req, res, next) {
  try {
    const data = await svc.cancelReservation(req.params.id, req.user.tid);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function noShow(req, res, next) {
  try {
    const data = await svc.markNoShow(req.params.id, req.user.tid);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function extend(req, res, next) {
  try {
    validate(req);
    const data = await svc.extendStay(req.params.resRoomId, req.user.tid, req.body.extra_nights);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ─── Operational Methods ───

async function changeMainGuest(req, res, next) {
  try {
    const data = await svc.changeResponsible(req.params.id, req.user.tid, req.body.new_guest_id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function updateFinances(req, res, next) {
  try {
    const data = await svc.updateReservationFinancials(req.params.id, req.user.tid, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function addGuest(req, res, next) {
  try {
    const data = await svc.addGuestToRoom(req.params.resRoomId, req.user.tid, req.body.guest_id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function addGuestToReservation(req, res, next) {
  try {
    const data = await svc.addGuestToReservation(req.params.id, req.user.tid, req.body.guest_id, req.body.res_room_id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function removeGuest(req, res, next) {
  try {
    const data = await svc.removeGuestFromReservation(req.params.guestResId, req.user.tid);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function updateGuestData(req, res, next) {
  try {
    const data = await svc.updateGuestInReservation(req.params.guestResId, req.user.tid, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function notifyPortal(req, res, next) {
  try {
    const { method, guest_name, email, phone, portal_url } = req.body;
    let result;
    if (method === 'EMAIL') {
      result = await notifySvc.sendPortalLinkEmail(req.params.id, guest_name, email, portal_url);
    } else {
      result = await notifySvc.sendPortalLinkWhatsApp(req.params.id, guest_name, phone, portal_url);
    }
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function assignGuestToRoom(req, res, next) {
  try {
    const data = await svc.assignGuestToRoom(req.params.guestResId, req.user.tid, req.body.res_room_id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function assignPhysicalRoom(req, res, next) {
  try {
    const data = await svc.assignPhysicalRoom(req.params.resRoomId, req.user.tid, req.body.room_id, req.body.room_number);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function checkIn(req, res, next) {
  try {
    const data = await svc.completeCheckIn(req.params.id, req.user.tid);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function relocate(req, res, next) {
  try {
    const data = await svc.relocateRoom(req.params.resRoomId, req.user.tid, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

module.exports = { 
  create, list, getOne, edit, cancel, noShow, extend,
  changeMainGuest, updateFinances, addGuest, addGuestToReservation, removeGuest, updateGuestData, notifyPortal,
  assignGuestToRoom, assignPhysicalRoom, checkIn, relocate
};
