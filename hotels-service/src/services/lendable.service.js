const { LendableItem, ItemInventory } = require('../models');
const AppError = require('../middlewares/AppError');
const { publishEvent } = require('../config/rabbitmq');

// ─── Catalog CRUD ─────────────────────────────────────────────────────────────

async function createLendableItem({ tenant_id, name, description, replacement_cost }) {
  const exists = await LendableItem.findOne({ where: { tenant_id, name } });
  if (exists) throw new AppError(`El artículo "${name}" ya existe`, 409, 'ITEM_EXISTS');

  const t = await LendableItem.sequelize.transaction();
  try {
    const item = await LendableItem.create(
      { tenant_id, name, description, replacement_cost },
      { transaction: t }
    );
    // Auto-create inventory row with zero stock
    await ItemInventory.create(
      { tenant_id, item_id: item.id, total_qty: 0, available_qty: 0, damaged_qty: 0 },
      { transaction: t }
    );
    await t.commit();
    return item;
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

async function listLendableItems(tenant_id) {
  return LendableItem.findAll({
    where: { tenant_id },
    include: [{ model: ItemInventory, as: 'inventory' }],
    order: [['name', 'ASC']],
  });
}

async function getLendableItem(id, tenant_id) {
  const item = await LendableItem.findOne({
    where: { id, tenant_id },
    include: [{ model: ItemInventory, as: 'inventory' }],
  });
  if (!item) throw new AppError('Artículo no encontrado', 404, 'ITEM_NOT_FOUND');
  return item;
}

async function updateLendableItem(id, tenant_id, data) {
  const item = await getLendableItem(id, tenant_id);
  await item.update(data);
  return item;
}

async function deleteLendableItem(id, tenant_id) {
  const item = await getLendableItem(id, tenant_id);
  await item.destroy(); // cascade deletes inventory row
  return { deleted: true, id };
}

// ─── Inventory operations ─────────────────────────────────────────────────────

/**
 * Adjust stock levels.
 * @param {string} reason  "PURCHASE" | "WRITE_OFF" | "DAMAGE_REPAIR"
 * @param {number} qty     Positive = add, Negative = remove
 */
async function adjustInventory(itemId, tenant_id, qty, reason) {
  const inv = await ItemInventory.findOne({ where: { item_id: itemId, tenant_id } });
  if (!inv) throw new AppError('Inventario no encontrado', 404, 'INVENTORY_NOT_FOUND');

  let newTotal = inv.total_qty;
  let newAvailable = inv.available_qty;

  // PURCHASE/WRITE_OFF/DAMAGE_REPAIR affect the PHYSICAL total
  // LENT/RETURNED only affect AVAILABILITY
  if (['PURCHASE', 'WRITE_OFF', 'DAMAGE_REPAIR', 'CORRECTION'].includes(reason)) {
    newTotal += qty;
    newAvailable += qty;
  } else if (['LENT', 'RETURNED'].includes(reason)) {
    newAvailable += qty;
  }

  if (newTotal < 0 || newAvailable < 0) {
    throw new AppError('Stock insuficiente para esta operación', 400, 'INSUFFICIENT_STOCK', {
      current_total:     inv.total_qty,
      current_available: inv.available_qty,
      requested:         qty,
    });
  }

  await inv.update({ total_qty: newTotal, available_qty: newAvailable });

  // Low stock alert
  if (newAvailable <= inv.low_stock_threshold) {
    publishEvent('inventory.low_alert', {
      tenant_id,
      item_id:   itemId,
      available: newAvailable,
      threshold: inv.low_stock_threshold,
      reason,
      occurred_at: new Date().toISOString(),
    });
  }

  return inv;
}

module.exports = {
  createLendableItem,
  listLendableItems,
  getLendableItem,
  updateLendableItem,
  deleteLendableItem,
  adjustInventory,
};
