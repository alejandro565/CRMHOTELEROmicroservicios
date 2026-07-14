const { Op } = require('sequelize');
const { Tenant, Plan, SystemModule, TENANT_STATUS } = require('../models');
const NOT_DELETED = { deleted_at: { [Op.is]: null } };
const AppError = require('../middlewares/AppError');
const { setupTenantForOwner } = require('./authClient.service');
const { getActiveModulesForPlan } = require('./plan.service');
const {
  publishTenantProvisioned,
  publishTenantSuspended,
  publishTenantPlanChanged,
  publishTenantDeleted,
} = require('../events/publisher');

// ─── Queries ──────────────────────────────────────────────────────────────────

async function getTenantStatus(tenant_id) {
  const tenant = await Tenant.findOne({
    where: { id: tenant_id, ...NOT_DELETED },
    include: [{
      model: Plan, as: 'plan',
      include: [{ model: SystemModule, as: 'modules', through: { attributes: [] } }],
    }],
  });

  if (!tenant) return { exists: false, status: null, plan: null };

  return {
    exists: true,
    status: tenant.status,
    plan: {
      id:                  tenant.plan.id,
      name:                tenant.plan.name,
      max_hotels:          tenant.plan.max_hotels,
      max_rooms_per_hotel: tenant.plan.max_rooms_per_hotel,
      modules:             tenant.plan.modules.filter(m => m.is_active).map(m => m.id),
    },
  };
}

async function getTenantDetails(tenant_id) {
  const tenant = await Tenant.findOne({
    where: { id: tenant_id, ...NOT_DELETED },
    include: [{
      model: Plan, as: 'plan',
      include: [{ model: SystemModule, as: 'modules', through: { attributes: [] } }],
    }],
  });
  if (!tenant) throw new AppError('Tenant no encontrado', 404, 'TENANT_NOT_FOUND');
  return tenant;
}

async function listTenants({ status, owner_id, page = 1, limit = 20 } = {}) {
  const where = { ...NOT_DELETED };
  if (status)   where.status   = status;
  if (owner_id) where.owner_id = owner_id;

  const { count, rows } = await Tenant.findAndCountAll({
    where,
    include: [{ model: Plan, as: 'plan' }],
    order:   [['created_at', 'DESC']],
    limit,
    offset:  (page - 1) * limit,
  });
  return { total: count, page, total_pages: Math.ceil(count / limit), data: rows };
}

/**
 * List only the hotels belonging to the authenticated owner.
 * Used by HotelSelector after login.
 */
async function listMyHotels(owner_id) {
  const rows = await Tenant.findAll({
    where: { owner_id, ...NOT_DELETED, status: TENANT_STATUS.ACTIVE },
    include: [{ model: Plan, as: 'plan', attributes: ['id', 'name', 'max_hotels', 'max_rooms_per_hotel'] }],
    order:   [['created_at', 'ASC']],
  });
  return rows.map(t => ({
    tenant_id:           t.id,
    name:                t.name,
    plan_name:           t.plan?.name,
    max_hotels:          t.plan?.max_hotels,
    max_rooms_per_hotel: t.plan?.max_rooms_per_hotel,
    status:              t.status,
  }));
}

// ─── Create hotel ─────────────────────────────────────────────────────────────

/**
 * createHotel — called by the authenticated owner from HotelSelector.
 *
 * Replaces the old provisionNewHotel. The owner_id comes from the JWT (req.user.sub),
 * NOT from the request body — this is what makes it secure.
 *
 * The plan is taken from the owner's existing account — they can't choose
 * a different plan here (that's done on the signup or upgrade flow).
 *
 * @param {string} owner_id    — from JWT (req.user.sub)
 * @param {string} owner_email — from JWT (req.user.email) or resolved from auth-service
 * @param {string} name        — hotel display name
 * @param {string} tax_id      — NIT boliviano
 */
async function createHotel({ owner_id, owner_email, name, tax_id }) {
  // ── 1. NIT must be unique ──────────────────────────────────────────────────
  const taxDuplicate = await Tenant.findOne({ where: { tax_id } });
  if (taxDuplicate) {
    throw new AppError(`El NIT "${tax_id}" ya está registrado`, 409, 'TAX_ID_DUPLICATE');
  }

  // ── 2. Find the owner's plan from their existing hotels ───────────────────
  // All of an owner's hotels share the same plan.
  // If this is their first hotel, we need the plan_id from the request.
  // If not their first, we inherit the plan from their existing hotels.
  const existingHotels = await Tenant.findAll({
    where:   { owner_id, ...NOT_DELETED },
    include: [{ model: Plan, as: 'plan' }],
    order:   [['created_at', 'ASC']],
    limit:   1,
  });

  if (existingHotels.length === 0) {
    throw new AppError(
      'Debes tener al menos un hotel registrado para usar este endpoint. ' +
      'Usa POST /api/tenants/first para registrar tu primer hotel.',
      409,
      'NO_EXISTING_HOTEL'
    );
  }

  const plan = existingHotels[0].plan;

  // ── 3. Enforce max_hotels limit ───────────────────────────────────────────
  if (plan.max_hotels > 0) {
    const currentCount = await Tenant.count({
      where: { owner_id, ...NOT_DELETED, status: TENANT_STATUS.ACTIVE },
    });
    if (currentCount >= plan.max_hotels) {
      throw new AppError(
        `Tu plan "${plan.name}" permite un máximo de ${plan.max_hotels} hotel(es). ` +
        `Ya tienes ${currentCount}. Actualiza tu plan para agregar más.`,
        409,
        'HOTEL_LIMIT_REACHED',
        { current: currentCount, limit: plan.max_hotels, plan_name: plan.name }
      );
    }
  }

  // ── 4. Resolve modules ────────────────────────────────────────────────────
  const { active_modules } = await getActiveModulesForPlan(plan.id);

  // ── 5. Persist tenant ─────────────────────────────────────────────────────
  const tenant = await Tenant.create({
    plan_id:     plan.id,
    owner_id,
    owner_email,
    name,
    tax_id,
    status:      TENANT_STATUS.ACTIVE,
  });

  // ── 6. Link owner to the new hotel in auth-service ────────────────────────
  try {
    await setupTenantForOwner({
      tenant_id:           tenant.id,
      owner_id,
      hotel_name:          name,
      plan_name:           plan.name,
      max_hotels:          plan.max_hotels,
      max_rooms_per_hotel: plan.max_rooms_per_hotel,
      active_modules,
    });
  } catch (err) {
    await Tenant.destroy({ where: { id: tenant.id } });
    throw err;
  }

  // ── 7. Publish event ──────────────────────────────────────────────────────
  publishTenantProvisioned({
    tenant_id:   tenant.id,
    owner_id,
    plan_config: { max_hotels: plan.max_hotels, max_rooms_per_hotel: plan.max_rooms_per_hotel, modules: active_modules },
  });

  return {
    success:   true,
    tenant_id: tenant.id,
    name:      tenant.name,
    status:    tenant.status,
    plan: {
      id:                  plan.id,
      name:                plan.name,
      max_hotels:          plan.max_hotels,
      max_rooms_per_hotel: plan.max_rooms_per_hotel,
      modules:             active_modules,
    },
  };
}

/**
 * createFirstHotel — called during owner onboarding (after signup + plan selection).
 * This is the only place where plan_id comes from the request body.
 * After this, all additional hotels inherit the plan from the first one.
 *
 * @param {string} owner_id    — from JWT
 * @param {string} owner_email — from JWT
 * @param {string} plan_id     — chosen during signup
 * @param {string} name        — hotel name
 * @param {string} tax_id      — NIT
 */
async function createFirstHotel({ owner_id, owner_email, plan_id, name, tax_id }) {
  // Must not have any existing hotels
  const existing = await Tenant.findOne({ where: { owner_id, ...NOT_DELETED } });
  if (existing) {
    throw new AppError(
      'Ya tienes hoteles registrados. Usa POST /api/tenants para agregar más.',
      409,
      'ALREADY_HAS_HOTELS'
    );
  }

  const taxDuplicate = await Tenant.findOne({ where: { tax_id } });
  if (taxDuplicate) {
    throw new AppError(`El NIT "${tax_id}" ya está registrado`, 409, 'TAX_ID_DUPLICATE');
  }

  const { plan, active_modules } = await getActiveModulesForPlan(plan_id);

  const tenant = await Tenant.create({
    plan_id,
    owner_id,
    owner_email,
    name,
    tax_id,
    status: TENANT_STATUS.ACTIVE,
  });

  try {
    await setupTenantForOwner({
      tenant_id:           tenant.id,
      owner_id,
      hotel_name:          name,
      plan_name:           plan.name,
      max_hotels:          plan.max_hotels,
      max_rooms_per_hotel: plan.max_rooms_per_hotel,
      active_modules,
    });
  } catch (err) {
    await Tenant.destroy({ where: { id: tenant.id } });
    throw err;
  }

  publishTenantProvisioned({
    tenant_id:   tenant.id,
    owner_id,
    plan_config: { max_hotels: plan.max_hotels, max_rooms_per_hotel: plan.max_rooms_per_hotel, modules: active_modules },
  });

  return {
    success:   true,
    tenant_id: tenant.id,
    name:      tenant.name,
    status:    tenant.status,
    plan: {
      id:                  plan.id,
      name:                plan.name,
      max_hotels:          plan.max_hotels,
      max_rooms_per_hotel: plan.max_rooms_per_hotel,
      modules:             active_modules,
    },
  };
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

async function suspendHotel(tenant_id, reason) {
  const tenant = await _getActiveTenant(tenant_id);
  if (tenant.status === TENANT_STATUS.SUSPENDED) {
    throw new AppError('El tenant ya está suspendido', 400, 'ALREADY_SUSPENDED');
  }
  await tenant.update({ status: TENANT_STATUS.SUSPENDED });
  publishTenantSuspended({ tenant_id, reason });
  return tenant;
}

async function reactivateHotel(tenant_id) {
  const tenant = await _getActiveTenant(tenant_id);
  if (tenant.status === TENANT_STATUS.ACTIVE) {
    throw new AppError('El tenant ya está activo', 400, 'ALREADY_ACTIVE');
  }
  await tenant.update({ status: TENANT_STATUS.ACTIVE });
  return tenant;
}

async function updateHotelPlan(tenant_id, new_plan_id) {
  const tenant = await _getActiveTenant(tenant_id);
  const old_plan_id = tenant.plan_id;
  if (old_plan_id === new_plan_id) {
    throw new AppError('El tenant ya tiene ese plan', 400, 'PLAN_UNCHANGED');
  }

  const { plan: newPlan, active_modules } = await getActiveModulesForPlan(new_plan_id);

  if (newPlan.max_hotels > 0) {
    const hotelCount = await Tenant.count({
      where: { owner_id: tenant.owner_id, ...NOT_DELETED, status: TENANT_STATUS.ACTIVE },
    });
    if (hotelCount > newPlan.max_hotels) {
      throw new AppError(
        `El nuevo plan solo permite ${newPlan.max_hotels} hotel(es) pero tienes ${hotelCount} activos.`,
        409,
        'PLAN_DOWNGRADE_BLOCKED',
        { current: hotelCount, new_limit: newPlan.max_hotels }
      );
    }
  }

  // Update ALL hotels of this owner to the new plan
  await Tenant.update(
    { plan_id: new_plan_id },
    { where: { owner_id: tenant.owner_id, ...NOT_DELETED } }
  );

  publishTenantPlanChanged({
    tenant_id,
    owner_id:    tenant.owner_id,
    old_plan_id,
    new_plan_id,
    new_config:  { max_hotels: newPlan.max_hotels, max_rooms_per_hotel: newPlan.max_rooms_per_hotel, modules: active_modules },
  });

  return {
    tenant_id, old_plan_id, new_plan_id,
    new_config: { max_hotels: newPlan.max_hotels, max_rooms_per_hotel: newPlan.max_rooms_per_hotel, modules: active_modules },
  };
}

async function softDeleteHotel(tenant_id, owner_id) {
  const tenant = await _getActiveTenant(tenant_id);

  // Only the owner can delete their own hotel
  if (tenant.owner_id !== owner_id) {
    throw new AppError('No tienes permiso para eliminar este hotel', 403, 'FORBIDDEN');
  }

  await tenant.update({ deleted_at: new Date(), status: TENANT_STATUS.INACTIVE });
  publishTenantDeleted({ tenant_id });
  return { success: true, tenant_id, deleted_at: tenant.deleted_at };
}

// ─── Private ──────────────────────────────────────────────────────────────────

async function _getActiveTenant(tenant_id) {
  const tenant = await Tenant.findOne({ where: { id: tenant_id, ...NOT_DELETED } });
  if (!tenant) throw new AppError('Tenant no encontrado', 404, 'TENANT_NOT_FOUND');
  return tenant;
}

module.exports = {
  getTenantStatus, getTenantDetails, listTenants, listMyHotels,
  createFirstHotel, createHotel,
  suspendHotel, reactivateHotel, updateHotelPlan, softDeleteHotel,
};
