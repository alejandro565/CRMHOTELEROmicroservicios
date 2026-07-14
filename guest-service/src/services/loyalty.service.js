const { LoyaltyLevel, GuestStats } = require('../models');
const AppError = require('../middlewares/AppError');
const { publishEvent } = require('../config/rabbitmq');

// ─── Seeder (called on TENANT_PROVISIONED) ────────────────────────────────────

async function seedDefaultLevel(tenant_id) {
  const [level, created] = await LoyaltyLevel.findOrCreate({
    where: { tenant_id, name: 'Normal' },
    defaults: {
      tenant_id,
      name: 'Normal',
      min_stays: 0,
      discount_percentage: 0.0,
      description: 'Nivel base para todos los huéspedes nuevos',
      is_default: true,
    },
  });
  if (created) console.log(`[LoyaltyService] default level seeded for tenant ${tenant_id}`);
  return level;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

async function createLevel({ tenant_id, name, min_stays, discount_percentage, description }) {
  const exists = await LoyaltyLevel.findOne({ where: { tenant_id, name } });
  if (exists) throw new AppError(`El nivel "${name}" ya existe`, 409, 'LEVEL_EXISTS');

  return LoyaltyLevel.create({ tenant_id, name, min_stays, discount_percentage, description, is_default: false });
}

async function listLevels(tenant_id) {
  return LoyaltyLevel.findAll({ where: { tenant_id }, order: [['min_stays', 'ASC']] });
}

async function updateLevel(id, tenant_id, data) {
  const level = await _getLevel(id, tenant_id);
  // Protect the default "Normal" level from discount changes that would break new guests
  if (level.is_default && data.min_stays !== undefined && data.min_stays !== 0) {
    throw new AppError('El nivel base siempre debe tener min_stays = 0', 400, 'DEFAULT_LEVEL_PROTECTED');
  }
  await level.update(data);
  return level;
}

async function deleteLevel(id, tenant_id) {
  const level = await _getLevel(id, tenant_id);
  if (level.is_default) throw new AppError('El nivel base no puede eliminarse', 403, 'DEFAULT_LEVEL_PROTECTED');

  // Reassign guests on this level to the default before deleting
  const defaultLevel = await LoyaltyLevel.findOne({ where: { tenant_id, is_default: true } });
  if (defaultLevel) {
    await GuestStats.update(
      { current_loyalty_level_id: defaultLevel.id },
      { where: { tenant_id, current_loyalty_level_id: id } }
    );
  }

  await level.destroy();
  return { deleted: true, id };
}

// ─── Loyalty engine ───────────────────────────────────────────────────────────

/**
 * Recalculate a guest's loyalty level based on their total_stays.
 * Finds the highest level whose min_stays <= total_stays.
 * Fires LOYALTY_LEVEL_UP event if the guest advances.
 */
async function recalculateGuestLoyalty(guest_id, tenant_id) {
  const stats = await GuestStats.findOne({
    where: { guest_id, tenant_id },
    include: [{ model: LoyaltyLevel, as: 'loyalty_level' }],
  });
  if (!stats) return null;

  // Get all levels sorted by min_stays DESC — highest qualifying level first
  const levels = await LoyaltyLevel.findAll({
    where: { tenant_id, min_stays: { [require('sequelize').Op.lte]: stats.total_stays } },
    order: [['min_stays', 'DESC']],
  });

  if (!levels.length) return stats;

  const bestLevel = levels[0];
  const prevLevelId = stats.current_loyalty_level_id;

  if (bestLevel.id !== prevLevelId) {
    await stats.update({ current_loyalty_level_id: bestLevel.id });

    // Only publish level-up events (not level-downs, which shouldn't happen normally)
    if (!stats.loyalty_level || bestLevel.min_stays > (stats.loyalty_level?.min_stays || 0)) {
      publishEvent('loyalty.level_up', {
        tenant_id,
        guest_id,
        new_level:    bestLevel.name,
        new_discount: Number(bestLevel.discount_percentage),
        total_stays:  stats.total_stays,
        occurred_at:  new Date().toISOString(),
      });
    }
  }

  await stats.reload({ include: [{ model: LoyaltyLevel, as: 'loyalty_level' }] });
  return stats;
}

// ─── Private ──────────────────────────────────────────────────────────────────

async function _getLevel(id, tenant_id) {
  const level = await LoyaltyLevel.findOne({ where: { id, tenant_id } });
  if (!level) throw new AppError('Nivel de lealtad no encontrado', 404, 'LEVEL_NOT_FOUND');
  return level;
}

module.exports = { seedDefaultLevel, createLevel, listLevels, updateLevel, deleteLevel, recalculateGuestLoyalty };
