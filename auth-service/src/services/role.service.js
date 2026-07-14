const { Op } = require('sequelize');
const { Role, Permission, RolePermission, User } = require('../models');
const AppError = require('../middlewares/AppError');
const { publishEvent } = require('../config/rabbitmq');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve an array of permission slugs to Permission rows.
 * Throws if any slug is not found.
 */
async function _resolvePermissions(slugs) {
  if (!slugs || slugs.length === 0) return [];

  const perms = await Permission.findAll({ where: { slug: slugs } });
  const found = perms.map((p) => p.slug);
  const missing = slugs.filter((s) => !found.includes(s));

  if (missing.length) {
    throw new AppError('Permisos no encontrados', 404, 'PERMISSION_NOT_FOUND', {
      missing_slugs: missing,
    });
  }
  return perms;
}

/**
 * Replace all permissions for a role atomically.
 */
async function _replacePermissions(roleId, permissionSlugs, transaction) {
  const perms = await _resolvePermissions(permissionSlugs);

  // Delete existing links
  await RolePermission.destroy({ where: { role_id: roleId }, transaction });

  // Insert new links
  if (perms.length) {
    const records = perms.map((p) => ({ role_id: roleId, permission_id: p.id }));
    await RolePermission.bulkCreate(records, { transaction });
  }

  return perms;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * List system roles + tenant-specific roles.
 * SELECT WHERE tenant_id = :id OR tenant_id IS NULL
 */
async function listTenantRoles(tenantId) {
  const roles = await Role.findAll({
    where: {
      [Op.or]: [{ tenant_id: tenantId }, { tenant_id: null }],
    },
    include: [
      { model: Permission, as: 'permissions', through: { attributes: [] } },
    ],
    order: [
      ['is_system_role', 'DESC'],
      ['name', 'ASC'],
    ],
  });
  return roles;
}

async function getRoleById(roleId, tenantId) {
  const role = await Role.findOne({
    where: {
      id: roleId,
      [Op.or]: [{ tenant_id: tenantId }, { tenant_id: null }],
    },
    include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }],
  });
  if (!role) throw new AppError('Rol no encontrado', 404, 'ROLE_NOT_FOUND');
  return role;
}

// ─── Create ───────────────────────────────────────────────────────────────────

async function createRole({ name, description, permission_slugs, tenant_id }) {
  // Check name uniqueness within tenant scope
  const existing = await Role.findOne({ where: { name, tenant_id } });
  if (existing) throw new AppError(`El rol "${name}" ya existe`, 409, 'ROLE_NAME_EXISTS');

  const t = await Role.sequelize.transaction();
  try {
    const role = await Role.create(
      { name, description, tenant_id, is_system_role: false },
      { transaction: t }
    );

    const perms = await _replacePermissions(role.id, permission_slugs || [], t);
    await t.commit();

    return {
      role_id:              role.id,
      name:                 role.name,
      assigned_permissions: perms.length,
    };
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

// ─── Update ───────────────────────────────────────────────────────────────────

async function updateRole(roleId, { name, description, permission_slugs }, tenantId) {
  const role = await Role.findOne({ where: { id: roleId, tenant_id: tenantId } });
  if (!role) throw new AppError('Rol no encontrado', 404, 'ROLE_NOT_FOUND');

  if (role.is_system_role) {
    throw new AppError('Los roles del sistema no pueden modificarse', 403, 'SYSTEM_ROLE_PROTECTED');
  }

  const t = await Role.sequelize.transaction();
  try {
    if (name || description) {
      await role.update({ name, description }, { transaction: t });
    }

    let perms = [];
    if (permission_slugs !== undefined) {
      perms = await _replacePermissions(role.id, permission_slugs, t);
    }

    await t.commit();

    // Signal that active sessions may need re-validation
    publishEvent('role.permissions_changed', {
      role_id:   roleId,
      tenant_id: tenantId,
      occurred_at: new Date().toISOString(),
    });

    return {
      role_id:              role.id,
      name:                 role.name,
      assigned_permissions: perms.length,
    };
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

/**
 * Reassign permissions to a role (replaces existing set).
 * Standalone endpoint: PUT /roles/:roleId/permissions
 */
async function reassignPermissions(roleId, permission_slugs, tenantId) {
  const role = await Role.findOne({
    where: {
      id: roleId,
      [Op.or]: [{ tenant_id: tenantId }, { tenant_id: null }],
    },
  });
  if (!role) throw new AppError('Rol no encontrado', 404, 'ROLE_NOT_FOUND');
  if (role.is_system_role) {
    throw new AppError('Los roles del sistema no pueden modificarse', 403, 'SYSTEM_ROLE_PROTECTED');
  }

  const t = await Role.sequelize.transaction();
  try {
    const perms = await _replacePermissions(role.id, permission_slugs, t);
    await t.commit();

    publishEvent('role.permissions_changed', {
      role_id:   roleId,
      tenant_id: tenantId,
      occurred_at: new Date().toISOString(),
    });

    return { role_id: roleId, assigned_permissions: perms.length };
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

async function deleteRole(roleId, tenantId) {
  const role = await Role.findOne({ where: { id: roleId, tenant_id: tenantId } });
  if (!role) throw new AppError('Rol no encontrado', 404, 'ROLE_NOT_FOUND');
  if (role.is_system_role) {
    throw new AppError('Los roles del sistema no pueden eliminarse', 403, 'SYSTEM_ROLE_PROTECTED');
  }

  // Guard: don't orphan active users
  const activeUsers = await User.count({
    where: { role_id: roleId, is_active: true },
  });
  if (activeUsers > 0) {
    throw new AppError(
      `No se puede eliminar: ${activeUsers} usuario(s) activo(s) tienen este rol`,
      409,
      'ROLE_HAS_ACTIVE_USERS',
      { active_users: activeUsers }
    );
  }

  await role.destroy();
  return { deleted: true, role_id: roleId };
}

module.exports = {
  listTenantRoles,
  getRoleById,
  createRole,
  updateRole,
  reassignPermissions,
  deleteRole,
};
