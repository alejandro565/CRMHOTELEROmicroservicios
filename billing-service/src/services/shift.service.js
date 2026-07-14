const { Op } = require('sequelize');
const { CashierShift, Payment, SHIFT_STATUS } = require('../models');
const AppError = require('../middlewares/AppError');
const { publishEvent } = require('../config/rabbitmq');

async function openShift(tenant_id, user_id, starting_cash) {
  // Only one open shift per cashier at a time
  const existing = await CashierShift.findOne({
    where: { tenant_id, user_id, status: SHIFT_STATUS.OPEN },
  });
  if (existing) throw new AppError('Ya tienes un turno abierto', 409, 'SHIFT_ALREADY_OPEN', { shift_id: existing.id });

  return CashierShift.create({ tenant_id, user_id, starting_cash, status: SHIFT_STATUS.OPEN });
}

/**
 * Calculate the expected cash totals from all non-voided payments in the shift.
 * Groups by method AND received_currency so the cashier can count each pile separately.
 * Returns the structure shown in the API contract.
 */
async function getExpectedCash(shift_id, tenant_id) {
  const shift = await _getShift(shift_id, tenant_id);

  const payments = await Payment.findAll({
    where: { shift_id, tenant_id, is_voided: false },
    attributes: ['method', 'received_currency', 'received_amount', 'amount_base'],
  });

  // Group: { method → { currency → total_received } }
  const expected_totals = {};
  let summary_bob = Number(shift.starting_cash);

  for (const p of payments) {
    if (!expected_totals[p.method]) expected_totals[p.method] = {};
    const prev = expected_totals[p.method][p.received_currency] || 0;
    expected_totals[p.method][p.received_currency] = parseFloat((prev + Number(p.received_amount)).toFixed(2));
    summary_bob += Number(p.amount_base);
  }

  return {
    shift_id,
    status:          shift.status,
    opened_at:       shift.opened_at,
    expected_totals,
    summary_in_base_currency: `${parseFloat(summary_bob.toFixed(2))} BOB`,
  };
}

async function closeShift(shift_id, tenant_id, actual_cash, notes) {
  const shift = await _getShift(shift_id, tenant_id);
  if (shift.status === SHIFT_STATUS.CLOSED) throw new AppError('El turno ya está cerrado', 409, 'SHIFT_ALREADY_CLOSED');

  const summary = await getExpectedCash(shift_id, tenant_id);
  // Expected CASH in BOB only (what's in the drawer)
  const expected_cash = Number(shift.starting_cash) +
    Object.values(
      (summary.expected_totals['CASH'] || {})
    ).reduce((a, b) => a + b, 0);

  const difference = parseFloat((expected_cash - actual_cash).toFixed(2));

  await shift.update({
    status:        SHIFT_STATUS.CLOSED,
    expected_cash: parseFloat(expected_cash.toFixed(2)),
    actual_cash:   parseFloat(actual_cash),
    difference,
    closed_at:     new Date(),
    notes,
  });

  // Publish totals for reporting-service
  publishEvent('billing.shift_closed', {
    tenant_id,
    shift_id,
    user_id:       shift.user_id,
    expected_cash,
    actual_cash,
    difference,
    expected_totals: summary.expected_totals,
    occurred_at:   new Date().toISOString(),
  });

  return shift;
}

async function getCurrentShift(tenant_id, user_id) {
  const shift = await CashierShift.findOne({
    where: { tenant_id, user_id, status: SHIFT_STATUS.OPEN },
    order: [['opened_at', 'DESC']],
  });
  if (!shift) throw new AppError('No hay turno abierto para este cajero', 404, 'NO_OPEN_SHIFT');
  return shift;
}

async function _getShift(shift_id, tenant_id) {
  const shift = await CashierShift.findOne({ where: { id: shift_id, tenant_id } });
  if (!shift) throw new AppError('Turno no encontrado', 404, 'SHIFT_NOT_FOUND');
  return shift;
}

module.exports = { openShift, getExpectedCash, closeShift, getCurrentShift };
