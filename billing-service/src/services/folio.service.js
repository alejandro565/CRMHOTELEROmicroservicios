const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { Folio, FolioRoutingRule, Charge, Payment, FOLIO_TYPE, FOLIO_STATUS, CHARGE_CATEGORIES } = require('../models');
const AppError = require('../middlewares/AppError');
const { publishEvent } = require('../config/rabbitmq');

// ─── Create ───────────────────────────────────────────────────────────────────

/**
 * Creates the Master + Incidental folio pair for a reservation.
 * Called automatically on RESERVATION_CREATED event.
 */
async function createFolioSet(tenant_id, reservation_id) {
  const existing = await Folio.findOne({ where: { tenant_id, reservation_id } });
  if (existing) {
    console.log(`[FolioService] folios already exist for reservation ${reservation_id}`);
    return;
  }

  const t = await sequelize.transaction();
  try {
    const master = await Folio.create(
      { tenant_id, reservation_id, type: FOLIO_TYPE.MASTER, status: FOLIO_STATUS.OPEN, balance: 0 },
      { transaction: t }
    );
    const incidental = await Folio.create(
      { tenant_id, reservation_id, type: FOLIO_TYPE.INCIDENTAL, status: FOLIO_STATUS.OPEN, balance: 0 },
      { transaction: t }
    );
    await t.commit();
    return { master, incidental };
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

// ─── Read ─────────────────────────────────────────────────────────────────────

async function getFoliosByReservation(reservation_id, tenant_id) {
  return Folio.findAll({
    where: { reservation_id, tenant_id },
    include: [
      { model: Charge,  as: 'charges',  where: { is_voided: false }, required: false },
      { model: Payment, as: 'payments', where: { is_voided: false }, required: false },
    ],
    order: [['type', 'DESC']],
  });
}

async function getFolio(folio_id, tenant_id) {
  const folio = await Folio.findOne({
    where: { id: folio_id, tenant_id },
    include: [
      { model: Charge,  as: 'charges',  where: { is_voided: false }, required: false },
      { model: Payment, as: 'payments', where: { is_voided: false }, required: false },
    ],
  });
  if (!folio) throw new AppError('Folio no encontrado', 404, 'FOLIO_NOT_FOUND');
  return folio;
}

// ─── Balance ──────────────────────────────────────────────────────────────────

/**
 * Recalculate and persist the folio balance.
 * balance = sum(active charges) - sum(active payments)
 * Emits FOLIO_CLEARED when balance reaches 0.
 */
async function updateFolioBalance(folio_id, tenant_id, transaction) {
  const folio = await Folio.findOne({ where: { id: folio_id, tenant_id }, transaction });
  if (!folio) throw new AppError('Folio no encontrado', 404, 'FOLIO_NOT_FOUND');

  const [chargesResult, paymentsResult] = await Promise.all([
    Charge.sum('amount',       { where: { folio_id, tenant_id, is_voided: false }, transaction }),
    Payment.sum('amount_base', { where: { folio_id, tenant_id, is_voided: false }, transaction }),
  ]);

  const totalCharges  = parseFloat(chargesResult  || 0);
  const totalPayments = parseFloat(paymentsResult || 0);
  const balance       = parseFloat((totalCharges - totalPayments).toFixed(2));

  await folio.update({ balance }, { transaction });

  // Notify reservation-service that checkout is now allowed
  if (balance <= 0 && folio.status === FOLIO_STATUS.OPEN) {
    publishEvent('billing.folio_cleared', {
      tenant_id,
      folio_id,
      reservation_id: folio.reservation_id,
      balance,
      occurred_at: new Date().toISOString(),
    });
  }

  // Always notify reservation-service of the NEW TOTAL BALANCE for the reservation
  const allFolios = await Folio.findAll({ 
    where: { reservation_id: folio.reservation_id, tenant_id },
    transaction
  });
  const totalReservationBalance = allFolios.reduce((acc, f) => acc + parseFloat(f.balance), 0);

  publishEvent('billing.balance_updated', {
    tenant_id,
    reservation_id: folio.reservation_id,
    total_balance: parseFloat(totalReservationBalance.toFixed(2)),
    occurred_at: new Date().toISOString(),
  });

  return { folio_id, balance, total_charges: totalCharges, total_payments: totalPayments };
}

// ─── Routing ──────────────────────────────────────────────────────────────────

/**
 * Move a specific charge from one folio to another.
 * Used for the Master/Incidental routing pattern.
 */
async function routeCharge(charge_id, target_folio_id, tenant_id) {
  const charge = await Charge.findOne({ where: { id: charge_id, tenant_id, is_voided: false } });
  if (!charge) throw new AppError('Cargo no encontrado', 404, 'CHARGE_NOT_FOUND');

  const targetFolio = await Folio.findOne({ where: { id: target_folio_id, tenant_id, status: FOLIO_STATUS.OPEN } });
  if (!targetFolio) throw new AppError('Folio destino no encontrado o cerrado', 404, 'TARGET_FOLIO_NOT_FOUND');

  const source_folio_id = charge.folio_id;

  const t = await sequelize.transaction();
  try {
    await charge.update({ folio_id: target_folio_id }, { transaction: t });
    await updateFolioBalance(source_folio_id, tenant_id, t);
    await updateFolioBalance(target_folio_id, tenant_id, t);
    await t.commit();
    return charge;
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

/**
 * Create or update a routing rule so that future charges of a category
 * are automatically applied to the target folio.
 */
async function setRoutingRule(tenant_id, source_folio_id, target_folio_id, category_to_move) {
  if (!CHARGE_CATEGORIES.includes(category_to_move)) {
    throw new AppError(`Categoría inválida: ${category_to_move}`, 400, 'INVALID_CATEGORY');
  }
  const [rule] = await FolioRoutingRule.findOrCreate({
    where: { source_folio_id, category_to_move },
    defaults: { tenant_id, source_folio_id, target_folio_id, category_to_move },
  });
  if (rule.target_folio_id !== target_folio_id) {
    await rule.update({ target_folio_id });
  }
  return rule;
}

// ─── Settle ───────────────────────────────────────────────────────────────────

/**
 * settlefolio — high-level action that processes a mixed payment and optionally
 * generates an invoice. Intended for the "close the bill" moment.
 * Delegates to charge.service and payment.service internally.
 */
async function markFolioSettled(folio_id, tenant_id) {
  const folio = await Folio.findOne({ where: { id: folio_id, tenant_id } });
  if (!folio) throw new AppError('Folio no encontrado', 404, 'FOLIO_NOT_FOUND');
  if (folio.balance > 0) throw new AppError(`Saldo pendiente de Bs ${folio.balance}`, 409, 'PENDING_BALANCE', { balance: folio.balance });
  await folio.update({ status: FOLIO_STATUS.SETTLED });
  return folio;
}

async function listAllFolios(tenant_id, { status, limit = 50 } = {}) {
  const where = { tenant_id };
  if (status) where.status = status;
  return Folio.findAll({
    where,
    limit: parseInt(limit),
    order: [['created_at', 'DESC']],
    include: [
      { model: Charge,  as: 'charges',  where: { is_voided: false }, required: false },
      { model: Payment, as: 'payments', where: { is_voided: false }, required: false },
    ],
  });
}

module.exports = {
  createFolioSet,
  getFoliosByReservation,
  getFolio,
  updateFolioBalance,
  routeCharge,
  setRoutingRule,
  markFolioSettled,
  listAllFolios,
};
