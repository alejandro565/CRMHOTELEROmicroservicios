const bcrypt = require('bcryptjs');
const { Op }  = require('sequelize');
const { sequelize } = require('../config/database');
const { User, Role, LocalTenant, UserTenant, TENANT_STATUS } = require('../models');
const AppError = require('../middlewares/AppError');

function _safeUser(user) {
  return {
    id:                   user.id,
    email:                user.email,
    full_name:            user.full_name,
    role_id:              user.role_id,
    role_name:            user.role?.name || null,
    is_active:            user.is_active,
    last_login:           user.last_login,
    must_change_password: user.must_change_password,
  };
}

async function _resolveRole(roleId, tenantId) {
  const role = await Role.findOne({
    where: { id: roleId, [Op.or]: [{ tenant_id: tenantId }, { tenant_id: null }] },
  });
  if (!role) throw new AppError('Rol no encontrado o no pertenece a este tenant', 404, 'ROLE_NOT_FOUND');
  return role;
}

// ── Create ────────────────────────────────────────────────────────────────────

async function createUser({ full_name, email, role_id, tenant_id, password }) {
  await _resolveRole(role_id, tenant_id);

  const existing = await User.findOne({ where: { email: email.toLowerCase() } });

  const t = await sequelize.transaction();
  try {
    if (existing) {
      // User exists — just link to this tenant (multi-hotel)
      const alreadyLinked = await UserTenant.findOne({
        where: { user_id: existing.id, tenant_id }, transaction: t,
      });
      if (alreadyLinked) {
        await t.rollback();
        throw new AppError('Este usuario ya tiene acceso a este hotel', 409, 'ALREADY_LINKED');
      }
      await UserTenant.create(
        { user_id: existing.id, tenant_id, role_id, is_active: true },
        { transaction: t }
      );
      await t.commit();
      return _safeUser(existing);
    }

    const password_hash = await bcrypt.hash(password, 12);
    const user = await User.create({
      full_name, email: email.toLowerCase(),
      password_hash, role_id, tenant_id,
      is_active: true, must_change_password: true,
    }, { transaction: t });

    await UserTenant.create(
      { user_id: user.id, tenant_id, role_id, is_active: true },
      { transaction: t }
    );

    await t.commit();
    return _safeUser(user);
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

// ── Read ──────────────────────────────────────────────────────────────────────

async function listUsers(tenantId, { page = 1, limit = 20, active } = {}) {
  const where = { tenant_id: tenantId };
  if (typeof active === 'boolean') where.is_active = active;

  const utWhere = { tenant_id: tenantId };
  if (typeof active === 'boolean') utWhere.is_active = active;

  const { count, rows } = await UserTenant.findAndCountAll({
    where: utWhere,
    include: [
      {
        model: User, as: 'user',
        attributes: { exclude: ['password_hash', 'reset_token', 'reset_token_expires'] },
        include: [{ model: Role, as: 'role', attributes: ['id', 'name'] }],
      },
      { model: Role, as: 'role', attributes: ['id', 'name'] },
    ],
    order:  [['created_at', 'DESC']],
    limit,
    offset: (page - 1) * limit,
  });

  return {
    total: count, page,
    total_pages: Math.ceil(count / limit),
    data: rows.map((ut) => ({
      ..._safeUser(ut.user),
      role_id:   ut.role_id,
      role_name: ut.role?.name || null,
      work_schedule: ut.work_schedule || null,
    })),
  };
}

async function getUserById(userId, tenantId) {
  const user = await User.findOne({
    where:   { id: userId },
    include: [{ model: Role, as: 'role', attributes: ['id', 'name'] }],
  });
  if (!user) throw new AppError('Usuario no encontrado', 404, 'USER_NOT_FOUND');

  const ut = await UserTenant.findOne({ where: { user_id: userId, tenant_id: tenantId } });
  if (!ut) throw new AppError('Usuario no encontrado', 404, 'USER_NOT_FOUND');

  return {
    ..._safeUser(user),
    work_schedule: ut.work_schedule || null,
  };
}

// ── Update ────────────────────────────────────────────────────────────────────

async function updateUserRole(userId, newRoleId, tenantId) {
  await _resolveRole(newRoleId, tenantId);

  const ut = await UserTenant.findOne({ where: { user_id: userId, tenant_id: tenantId } });
  if (!ut) throw new AppError('Usuario no encontrado', 404, 'USER_NOT_FOUND');
  await ut.update({ role_id: newRoleId });

  const user = await User.findByPk(userId, { include: [{ model: Role, as: 'role' }] });
  if (user.tenant_id === tenantId) await user.update({ role_id: newRoleId });

  return _safeUser(user);
}

async function toggleUserActive(userId, tenantId, is_active) {
  const ut = await UserTenant.findOne({ where: { user_id: userId, tenant_id: tenantId } });
  if (!ut) throw new AppError('Usuario no encontrado', 404, 'USER_NOT_FOUND');
  await ut.update({ is_active });

  const user = await User.findByPk(userId, { include: [{ model: Role, as: 'role' }] });
  return _safeUser(user);
}

async function updateUserSchedule(userId, work_schedule, tenantId) {
  const ut = await UserTenant.findOne({ where: { user_id: userId, tenant_id: tenantId } });
  if (!ut) throw new AppError('Usuario no encontrado', 404, 'USER_NOT_FOUND');
  await ut.update({ work_schedule });

  const user = await User.findByPk(userId, { include: [{ model: Role, as: 'role' }] });
  return {
    ..._safeUser(user),
    work_schedule,
  };
}

// ── Multi-hotel tenant management ─────────────────────────────────────────────

async function linkUserToTenant({ email, tenant_id, role_id }) {
  const user = await User.findOne({ where: { email: email.toLowerCase() } });
  if (!user) throw new AppError('Usuario no encontrado', 404, 'USER_NOT_FOUND');

  await _resolveRole(role_id, tenant_id);

  const existing = await UserTenant.findOne({ where: { user_id: user.id, tenant_id } });
  if (existing) {
    if (!existing.is_active) await existing.update({ role_id, is_active: true });
    else throw new AppError('El usuario ya tiene acceso a este hotel', 409, 'ALREADY_LINKED');
  } else {
    await UserTenant.create({ user_id: user.id, tenant_id, role_id, is_active: true });
  }

  return { user_id: user.id, email: user.email, full_name: user.full_name, tenant_id, role_id };
}

async function unlinkUserFromTenant({ user_id, tenant_id }) {
  const ut = await UserTenant.findOne({ where: { user_id, tenant_id } });
  if (!ut) throw new AppError('Vínculo no encontrado', 404, 'LINK_NOT_FOUND');

  const user = await User.findByPk(user_id);
  if (user?.tenant_id === tenant_id) {
    throw new AppError('No se puede quitar el acceso al hotel primario del usuario', 409, 'PRIMARY_TENANT');
  }

  await ut.update({ is_active: false });
  return { success: true, user_id, tenant_id };
}

async function listUserTenants(user_id) {
  const rows = await UserTenant.findAll({
    where:   { user_id, is_active: true },
    include: [
      { model: LocalTenant, as: 'tenant' },
      { model: Role, as: 'role', attributes: ['id', 'name'] },
    ],
    order: [['created_at', 'ASC']],
  });

  return rows.map((ut) => ({
    tenant_id:           ut.tenant_id,
    hotel_name:          ut.tenant?.hotel_name || `Hotel ${ut.tenant_id.slice(0, 6)}`,
    plan_name:           ut.tenant?.plan_name,
    max_hotels:          ut.tenant?.max_hotels,
    max_rooms_per_hotel: ut.tenant?.max_rooms_per_hotel,
    role_id:             ut.role_id,
    role_name:           ut.role?.name,
    is_active:           ut.is_active,
  }));
}

// ── Internal: setup initial admin (called by saas-service) ───────────────────

async function setupInitialAdmin({
  tenant_id, email, full_name, initial_password,
  hotel_name, plan_name, max_hotels, max_rooms_per_hotel, active_modules,
}) {
  const t = await sequelize.transaction();
  try {
    // Upsert the local tenant mirror with all new fields
    const [tenant, tenantCreated] = await LocalTenant.findOrCreate({
      where:    { id: tenant_id },
      defaults: {
        hotel_name:          hotel_name || null,
        status:              TENANT_STATUS.ACTIVE,
        plan_name,
        max_hotels:          max_hotels          ?? 1,
        max_rooms_per_hotel: max_rooms_per_hotel ?? 0,
        active_modules:      active_modules      || [],
      },
      transaction: t,
    });

    if (!tenantCreated) {
      await tenant.update({
        hotel_name:          hotel_name || tenant.hotel_name,
        active_modules:      active_modules      || tenant.active_modules,
        plan_name:           plan_name           || tenant.plan_name,
        max_hotels:          max_hotels          ?? tenant.max_hotels,
        max_rooms_per_hotel: max_rooms_per_hotel ?? tenant.max_rooms_per_hotel,
      }, { transaction: t });
    }

    const adminRole = await Role.findOne({
      where: { name: 'TENANT_ADMIN', tenant_id: null }, transaction: t,
    });
    if (!adminRole) throw new AppError('Rol TENANT_ADMIN no encontrado', 500, 'ROLE_MISSING');

    // Check if user already exists (owner adding a second hotel)
    let user = await User.findOne({ where: { email: email.toLowerCase() }, transaction: t });

    if (user) {
      // Existing owner — just link to the new tenant
      const alreadyLinked = await UserTenant.findOne({
        where: { user_id: user.id, tenant_id }, transaction: t,
      });
      if (!alreadyLinked) {
        await UserTenant.create(
          { user_id: user.id, tenant_id, role_id: adminRole.id, is_active: true },
          { transaction: t }
        );
      }
      await t.commit();
      return { user_id: user.id, tenant_id, email: user.email, linked: true };
    }

    // New user
    const password_hash = await bcrypt.hash(initial_password, 12);
    user = await User.create({
      tenant_id,
      role_id:              adminRole.id,
      full_name,
      email:                email.toLowerCase(),
      password_hash,
      is_active:            true,
      must_change_password: true,
    }, { transaction: t });

    await UserTenant.create(
      { user_id: user.id, tenant_id, role_id: adminRole.id, is_active: true },
      { transaction: t }
    );

    await t.commit();
    return { user_id: user.id, tenant_id, email: user.email, linked: false };
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

// exports below

// ── Owner registration (public — called from SaaS signup page) ───────────────

/**
 * Register a new owner account from the SaaS signup page.
 *
 * The owner is created WITHOUT a tenant_id — they have no hotel yet.
 * Their JWT will carry role: OWNER and perms: [OWNER_CREATE_HOTEL, ...].
 * They land on HotelSelector which shows a "Create your first hotel" button.
 *
 * @param {string} full_name
 * @param {string} email
 * @param {string} password      — set by the user (not a temp password)
 * @returns {{ user_id, email, full_name }}
 */
async function registerOwner({ full_name, email, password }) {
  const existing = await User.findOne({ where: { email: email.toLowerCase() } });
  if (existing) throw new AppError('El email ya está en uso', 409, 'EMAIL_IN_USE');

  const ownerRole = await Role.findOne({ where: { name: 'OWNER', tenant_id: null } });
  if (!ownerRole) throw new AppError('Rol OWNER no encontrado — ejecuta el seeder', 500, 'ROLE_MISSING');

  const password_hash = await bcrypt.hash(password, 12);

  const user = await User.create({
    full_name,
    email:                email.toLowerCase(),
    password_hash,
    role_id:              ownerRole.id,
    tenant_id:            null,   // no hotel yet
    is_active:            true,
    must_change_password: false,  // owner sets their own password on signup
  });

  return { user_id: user.id, email: user.email, full_name: user.full_name };
}

module.exports = {
  createUser, listUsers, getUserById,
  updateUserRole, toggleUserActive, updateUserSchedule,
  linkUserToTenant, unlinkUserFromTenant, listUserTenants,
  setupInitialAdmin,
  registerOwner,
};
