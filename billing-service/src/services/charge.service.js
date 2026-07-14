const { sequelize } = require('../config/database');
const { Charge, Folio, FolioRoutingRule, FOLIO_STATUS } = require('../models');
const { updateFolioBalance } = require('./folio.service');
const AppError = require('../middlewares/AppError');

/**
 * Add a charge to a folio.
 * Negative amounts are commercial adjustments (regateo/discount).
 * Before inserting, checks if a routing rule exists for the category
 * and redirects to the target folio transparently.
 */
async function addCharge({ folio_id, tenant_id, category, amount, description, source_ref }) {
  const folio = await Folio.findOne({ where: { id: folio_id, tenant_id } });
  if (!folio) throw new AppError('Folio no encontrado', 404, 'FOLIO_NOT_FOUND');
  if (folio.status !== FOLIO_STATUS.OPEN) throw new AppError('El folio está cerrado', 409, 'FOLIO_CLOSED');

  // Check routing rule for this category
  const rule = await FolioRoutingRule.findOne({ where: { source_folio_id: folio_id, category_to_move: category } });
  const effective_folio_id = rule ? rule.target_folio_id : folio_id;

  const t = await sequelize.transaction();
  try {
    const charge = await Charge.create(
      { folio_id: effective_folio_id, tenant_id, category, amount, description, source_ref: source_ref || null },
      { transaction: t }
    );
    await updateFolioBalance(effective_folio_id, tenant_id, t);
    await t.commit();

    // Label for clarity in response
    const is_discount     = amount < 0;
    const was_rerouted    = effective_folio_id !== folio_id;
    return { charge, is_discount, was_rerouted, effective_folio_id };
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

/**
 * Soft-void a charge (never physical deletion).
 * Recalculates folio balance after voiding.
 */
async function voidCharge(charge_id, tenant_id, voided_by_user_id, reason) {
  const charge = await Charge.findOne({ where: { id: charge_id, tenant_id } });
  if (!charge) throw new AppError('Cargo no encontrado', 404, 'CHARGE_NOT_FOUND');
  if (charge.is_voided) throw new AppError('El cargo ya fue anulado', 409, 'ALREADY_VOIDED');

  const t = await sequelize.transaction();
  try {
    await charge.update({ is_voided: true, voided_by_user_id, void_reason: reason }, { transaction: t });
    await updateFolioBalance(charge.folio_id, tenant_id, t);
    await t.commit();
    return charge;
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

async function listCharges(folio_id, tenant_id, { include_voided = false } = {}) {
  const where = { folio_id, tenant_id };
  if (!include_voided) where.is_voided = false;
  return Charge.findAll({ where, order: [['created_at', 'ASC']] });
}

module.exports = { addCharge, voidCharge, listCharges };
