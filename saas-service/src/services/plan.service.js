const { Plan, SystemModule, PlanModule } = require('../models');
const AppError = require('../middlewares/AppError');

/**
 * Create a plan and link it to existing active modules.
 */
async function definePlan({ name, price, max_hotels = 1, max_rooms_per_hotel = 0, module_ids }) {
  // 1. Check plan name is unique
  const existing = await Plan.findOne({ where: { name } });
  if (existing) {
    throw new AppError(`El plan "${name}" ya existe`, 409, 'PLAN_NAME_EXISTS');
  }

  // 2. Validate all module_ids exist and are active
  const modules = await SystemModule.findAll({ where: { id: module_ids } });

  const foundIds = modules.map((m) => m.id);
  const notFound = module_ids.filter((id) => !foundIds.includes(id));
  if (notFound.length) {
    throw new AppError('Uno o más módulos no existen', 404, 'MODULE_NOT_FOUND', {
      invalid_ids: notFound,
    });
  }

  const inactive = modules.filter((m) => !m.is_active).map((m) => m.id);
  if (inactive.length) {
    throw new AppError('Uno o más módulos están inactivos', 400, 'MODULE_INACTIVE', {
      inactive_ids: inactive,
    });
  }

  // 3. Create plan + join records in a single transaction
  const t = await Plan.sequelize.transaction();
  try {
    const plan = await Plan.create({ name, price, max_hotels, max_rooms_per_hotel }, { transaction: t });

    const joinRecords = module_ids.map((module_id) => ({ plan_id: plan.id, module_id }));
    await PlanModule.bulkCreate(joinRecords, { transaction: t });

    await t.commit();

    // Return plan with its modules eager-loaded
    return Plan.findByPk(plan.id, { include: [{ model: SystemModule, as: 'modules' }] });
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

async function listPlans({ activeOnly = false } = {}) {
  const where = activeOnly ? { is_active: true } : {};
  return Plan.findAll({
    where,
    include: [{ model: SystemModule, as: 'modules', through: { attributes: [] } }],
    order: [['price', 'ASC']],
  });
}

async function getPlanById(id) {
  const plan = await Plan.findByPk(id, {
    include: [{ model: SystemModule, as: 'modules', through: { attributes: [] } }],
  });
  if (!plan) throw new AppError(`Plan "${id}" no encontrado`, 404, 'PLAN_NOT_FOUND');
  return plan;
}

/**
 * Returns the array of active module slugs for a given plan.
 * Used internally to build the auth-service payload.
 */
async function getActiveModulesForPlan(plan_id) {
  const plan = await Plan.findByPk(plan_id, {
    include: [{ model: SystemModule, as: 'modules', through: { attributes: [] } }],
  });
  if (!plan) throw new AppError(`Plan "${plan_id}" no encontrado`, 404, 'PLAN_NOT_FOUND');
  return {
    plan,
    active_modules: plan.modules.filter((m) => m.is_active).map((m) => m.id),
  };
}

module.exports = { definePlan, listPlans, getPlanById, getActiveModulesForPlan };
