const { validationResult } = require('express-validator');
const folioSvc   = require('../services/folio.service');
const paymentSvc = require('../services/payment.service');
const invoiceSvc = require('../services/invoice.service');
const AppError   = require('../middlewares/AppError');

function validate(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new AppError('Datos inválidos', 400, 'VALIDATION_ERROR', { fields: errors.array() });
}

async function byReservation(req, res, next) {
  try {
    const data = await folioSvc.getFoliosByReservation(req.params.reservationId, req.user.tid);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const data = await folioSvc.getFolio(req.params.id, req.user.tid);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function recalcBalance(req, res, next) {
  try {
    const data = await folioSvc.updateFolioBalance(req.params.id, req.user.tid);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function route(req, res, next) {
  try {
    validate(req);
    const data = await folioSvc.routeCharge(req.body.charge_id, req.body.target_folio_id, req.user.tid);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function setRoutingRule(req, res, next) {
  try {
    validate(req);
    const { target_folio_id, category_to_move } = req.body;
    const data = await folioSvc.setRoutingRule(req.user.tid, req.params.id, target_folio_id, category_to_move);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/**
 * POST /folios/:id/settle
 * Accepts mixed payment + optional invoice in one shot.
 */
async function settle(req, res, next) {
  try {
    validate(req);
    const { payment, invoice } = req.body;

    // Process payment(s)
    let payments;
    if (payment?.method === 'MIXED') {
      payments = await paymentSvc.addMixedPayment({
        folio_id:  req.params.id,
        tenant_id: req.user.tid,
        user_id:   req.user.sub,
        details:   payment.details,
      });
    } else if (payment) {
      payments = [await paymentSvc.addPayment({
        folio_id:          req.params.id,
        tenant_id:         req.user.tid,
        user_id:           req.user.sub,
        method:            payment.method,
        received_currency: payment.currency || 'BOB',
        received_amount:   payment.amount,
      })];
    }

    // Mark folio settled
    const folio = await folioSvc.markFolioSettled(req.params.id, req.user.tid);

    // Optionally generate invoice
    let invoiceResult;
    if (invoice?.tax_id) {
      invoiceResult = await invoiceSvc.generateInvoice({
        folio_id:     req.params.id,
        tenant_id:    req.user.tid,
        nit_ci:       invoice.tax_id,
        razon_social: invoice.business_name,
        email:        invoice.email,
      });
    }

    res.json({ success: true, data: { folio, payments, invoice: invoiceResult || null } });
  } catch (err) { next(err); }
}

async function listAll(req, res, next) {
  try {
    const { status, limit } = req.query;
    const data = await folioSvc.listAllFolios(req.user.tid, { status, limit });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

module.exports = { byReservation, getOne, recalcBalance, route, setRoutingRule, settle, listAll };
