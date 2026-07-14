const { sequelize } = require('../config/database');
const { Payment, Folio, ExchangeRate, CashierShift, FOLIO_STATUS, SHIFT_STATUS, PAYMENT_METHOD } = require('../models');
const { updateFolioBalance } = require('./folio.service');
const AppError = require('../middlewares/AppError');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve the exchange rate for a currency on a given date.
 * Falls back to the most recent rate if today's rate hasn't been set.
 * BOB always resolves to 1.0 (base currency).
 */
async function _resolveRate(tenant_id, currency, date) {
  if (currency === 'BOB') return 1.0;

  // Try today's rate first, then fallback to latest
  const rate = await ExchangeRate.findOne({
    where: { tenant_id, currency, date },
  }) || await ExchangeRate.findOne({
    where: { tenant_id, currency },
    order: [['date', 'DESC']],
  });

  if (!rate) {
    throw new AppError(
      `No hay tasa de cambio registrada para ${currency}. Configure la tasa del día primero.`,
      404, 'EXCHANGE_RATE_NOT_FOUND', { currency }
    );
  }
  return Number(rate.rate);
}

/**
 * Find the active shift for the acting user.
 * Returns null gracefully if no shift is open (allows payments outside shifts in dev).
 */
async function _getActiveShift(tenant_id, user_id) {
  return CashierShift.findOne({
    where: { tenant_id, user_id, status: SHIFT_STATUS.OPEN },
  });
}

// ─── Single payment ───────────────────────────────────────────────────────────

async function addPayment({
  folio_id,
  tenant_id,
  user_id,
  method,
  received_currency,
  received_amount,
}) {
  const folio = await Folio.findOne({ where: { id: folio_id, tenant_id } });
  if (!folio) throw new AppError('Folio no encontrado', 404, 'FOLIO_NOT_FOUND');
  if (folio.status !== FOLIO_STATUS.OPEN) throw new AppError('El folio está cerrado', 409, 'FOLIO_CLOSED');

  if (!PAYMENT_METHOD.includes(method)) {
    throw new AppError(`Método inválido. Use: ${PAYMENT_METHOD.join(', ')}`, 400, 'INVALID_METHOD');
  }

  const today = new Date().toISOString().split('T')[0];
  const exchange_rate_used = await _resolveRate(tenant_id, received_currency, today);
  const amount_base = parseFloat((received_amount * exchange_rate_used).toFixed(2));

  const shift = await _getActiveShift(tenant_id, user_id);

  const t = await sequelize.transaction();
  try {
    const payment = await Payment.create(
      {
        folio_id, tenant_id,
        shift_id:           shift?.id || null,
        method,
        received_currency,
        received_amount:    parseFloat(received_amount),
        exchange_rate_used,
        amount_base,
      },
      { transaction: t }
    );
    await updateFolioBalance(folio_id, tenant_id, t);
    await t.commit();
    return payment;
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

/**
 * Mixed payment — processes multiple payment entries in a single transaction.
 * Used in the POST /folios/:id/settle endpoint.
 * Each detail entry can have its own currency and method.
 */
async function addMixedPayment({ folio_id, tenant_id, user_id, details }) {
  // details: [{ method, currency, amount }]
  const folio = await Folio.findOne({ where: { id: folio_id, tenant_id } });
  if (!folio) throw new AppError('Folio no encontrado', 404, 'FOLIO_NOT_FOUND');
  if (folio.status !== FOLIO_STATUS.OPEN) throw new AppError('El folio está cerrado', 409, 'FOLIO_CLOSED');

  const today = new Date().toISOString().split('T')[0];
  const shift = await _getActiveShift(tenant_id, user_id);

  const t = await sequelize.transaction();
  try {
    const payments = [];
    for (const detail of details) {
      const exchange_rate_used = await _resolveRate(tenant_id, detail.currency || 'BOB', today);
      const amount_base = parseFloat(((detail.amount || 0) * exchange_rate_used).toFixed(2));

      const p = await Payment.create(
        {
          folio_id, tenant_id,
          shift_id:           shift?.id || null,
          method:             detail.method || 'CASH',
          received_currency:  detail.currency || 'BOB',
          received_amount:    parseFloat(detail.amount),
          exchange_rate_used,
          amount_base,
        },
        { transaction: t }
      );
      payments.push(p);
    }

    await updateFolioBalance(folio_id, tenant_id, t);
    await t.commit();
    return payments;
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

// ─── Void ─────────────────────────────────────────────────────────────────────

async function voidPayment(payment_id, tenant_id, voided_by_user_id, reason) {
  const payment = await Payment.findOne({ where: { id: payment_id, tenant_id } });
  if (!payment) throw new AppError('Pago no encontrado', 404, 'PAYMENT_NOT_FOUND');
  if (payment.is_voided) throw new AppError('El pago ya fue anulado', 409, 'ALREADY_VOIDED');

  const t = await sequelize.transaction();
  try {
    await payment.update(
      { is_voided: true, voided_by_user_id, void_reason: reason },
      { transaction: t }
    );
    await updateFolioBalance(payment.folio_id, tenant_id, t);
    await t.commit();
    return payment;
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

async function listPayments(folio_id, tenant_id, { include_voided = false } = {}) {
  const where = { folio_id, tenant_id };
  if (!include_voided) where.is_voided = false;
  return Payment.findAll({ where, order: [['created_at', 'ASC']] });
}

async function listAllPayments(tenant_id, { shift_id, limit = 50 } = {}) {
  const where = { tenant_id };
  if (shift_id) where.shift_id = shift_id;
  return Payment.findAll({
    where,
    limit: parseInt(limit),
    order: [['created_at', 'DESC']],
    include: [{ model: Folio, as: 'folio', attributes: ['id', 'reservation_id', 'type'] }],
  });
}

module.exports = { addPayment, addMixedPayment, voidPayment, listPayments, listAllPayments };
