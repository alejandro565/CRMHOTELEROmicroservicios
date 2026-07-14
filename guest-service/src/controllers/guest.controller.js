const { validationResult } = require('express-validator');
const svc = require('../services/guest.service');
const AppError = require('../middlewares/AppError');

function validate(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error('[Guest Validation Error]', JSON.stringify(errors.array(), null, 2));
    throw new AppError('Datos inválidos', 400, 'VALIDATION_ERROR', { fields: errors.array() });
  }
}

async function create(req, res, next) {
  try {
    validate(req);
    const data = await svc.createGuest({ ...req.body, tenant_id: req.user.tid }, req.user.sub);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

async function list(req, res, next) {
  try {
    const { page, limit, search } = req.query;
    const data = await svc.listGuests(req.user.tid, {
      page:  page  ? parseInt(page)  : 1,
      limit: limit ? parseInt(limit) : 20,
      search,
    });
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const data = await svc.getGuest(req.params.id, req.user.tid);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    console.log('[Guest Update Payload]', JSON.stringify(req.body, null, 2));
    validate(req);
    const data = await svc.updateGuest(req.params.id, req.user.tid, req.body, req.user.sub);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const data = await svc.deleteGuest(req.params.id, req.user.tid, req.user.sub);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function search(req, res, next) {
  try {
    const { doc_type, doc_number } = req.query;
    if (!doc_type || !doc_number) {
      return next(new AppError('doc_type y doc_number son requeridos', 400, 'MISSING_PARAMS'));
    }
    const data = await svc.findGuestByDocument(req.user.tid, doc_type, doc_number);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function merge(req, res, next) {
  try {
    validate(req);
    const data = await svc.mergeGuests(
      req.params.id,
      req.body.duplicate_id,
      req.user.tid,
      req.user.sub,
    );
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function addDocument(req, res, next) {
  try {
    validate(req);
    const data = await svc.addDocument({
      ...req.body,
      guest_id:            req.params.id,
      tenant_id:           req.user.tid,
      uploaded_by_user_id: req.user.sub,
    });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

async function removeDocument(req, res, next) {
  try {
    const data = await svc.deleteDocument(req.params.docId, req.user.tid);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

module.exports = { create, list, getOne, update, remove, search, merge, addDocument, removeDocument };
