const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');

const { User, Role, Permission, LocalTenant, RefreshToken, UserTenant, TENANT_STATUS } = require('../models');
const { signAccessToken, generateRefreshToken, refreshTokenExpiresAt } = require('../config/jwt');
const { isWithinSchedule } = require('../utils/scheduleValidator');
const AppError = require('../middlewares/AppError');

async function _loadUserWithAccess(userId) {
  return User.findByPk(userId, {
    include: [
      { model: Role, as: 'role', include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }] },
      { model: LocalTenant, as: 'tenant' },
    ],
  });
}

/**
 * Issue access token for a specific (user, tenant) pair.
 * Used after hotel selection — reads role/permissions from UserTenant.
 */
async function _issueAccessTokenForTenant(user, tenantId) {
  const ut = await UserTenant.findOne({
    where:   { user_id: user.id, tenant_id: tenantId, is_active: true },
    include: [
      { model: Role,        as: 'role', include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }] },
      { model: LocalTenant, as: 'tenant' },
    ],
  });

  if (!ut) throw new AppError('Acceso denegado a este hotel', 403, 'TENANT_ACCESS_DENIED');

  // Prioritize global OWNER role over tenant-specific role
  const effectiveRole = user.role?.name === 'OWNER' ? 'OWNER' : ut.role?.name;

  if (ut.work_schedule && effectiveRole !== 'OWNER' && effectiveRole !== 'TENANT_ADMIN') {
    if (!isWithinSchedule(ut.work_schedule)) {
      throw new AppError('Acceso denegado: fuera de su horario laboral establecido.', 403, 'OUT_OF_SCHEDULE');
    }
  }

  return signAccessToken({
    userId:      user.id,
    email:       user.email,
    tenantId,
    role:        effectiveRole,
    modules:     ut.tenant?.active_modules || [],
    permissions: ut.role?.permissions?.map(p => p.slug) || [],
    schedule:    ut.work_schedule || null,
  });
}

/**
 * Issue access token using the user's primary tenant.
 * Used for single-hotel owners and OWNER users (tenantId will be null).
 */
function _issueAccessToken(user) {
  return signAccessToken({
    userId:      user.id,
    email:       user.email,
    tenantId:    user.tenant_id || null,
    role:        user.role?.name,
    modules:     user.tenant?.active_modules || [],
    permissions: user.role?.permissions?.map(p => p.slug) || [],
  });
}

async function _issueRefreshToken(userId, tenantId = null) {
  const token      = generateRefreshToken();
  const expires_at = refreshTokenExpiresAt();
  await RefreshToken.create({ user_id: userId, tenant_id: tenantId, token, expires_at });
  return token;
}

async function _getUserTenants(userId) {
  const rows = await UserTenant.findAll({
    where:   { user_id: userId, is_active: true },
    include: [
      { model: LocalTenant, as: 'tenant' },
      { model: Role,        as: 'role',   attributes: ['id', 'name'] },
    ],
    order: [['created_at', 'ASC']],
  });

  return rows
    .filter(ut => ut.tenant && ut.tenant.status === TENANT_STATUS.ACTIVE)
    .map(ut => ({
      tenant_id:           ut.tenant_id,
      hotel_name:          ut.tenant.hotel_name || `Hotel ${ut.tenant_id.slice(0, 6)}`,
      plan_name:           ut.tenant.plan_name,
      max_hotels:          ut.tenant.max_hotels,
      max_rooms_per_hotel: ut.tenant.max_rooms_per_hotel,
      role_name:           ut.role?.name,
      role_id:             ut.role_id,
    }));
}

// ── Login ─────────────────────────────────────────────────────────────────────

async function login(email, password) {
  const user = await User.findOne({
    where: { email: email.toLowerCase() },
    include: [
      { model: Role, as: 'role', include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }] },
      { model: LocalTenant, as: 'tenant' },
    ],
  });

  if (!user)          throw new AppError('Credenciales inválidas', 401, 'INVALID_CREDENTIALS');
  if (!user.is_active) throw new AppError('Usuario desactivado',   403, 'USER_INACTIVE');

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new AppError('Credenciales inválidas', 401, 'INVALID_CREDENTIALS');

  await user.update({ last_login: new Date() });

  // ── OWNER with no hotels yet ───────────────────────────────────────────────
  // tenant_id is null — issue JWT directly, frontend sends them to createFirstHotel
  if (user.role?.name === 'OWNER' && !user.tenant_id) {
    const tenants = await _getUserTenants(user.id);

    if (tenants.length === 0) {
      const accessToken  = _issueAccessToken(user);
      const refreshToken = await _issueRefreshToken(user.id, null);
      return {
        success:   true,
        accessToken,
        refreshToken,
        must_change_password: user.must_change_password,
        owner_has_no_hotels:  true,   // frontend redirects to createFirstHotel
        user: { id: user.id, email: user.email, name: user.full_name, role: user.role?.name, tenant_id: null },
        access: { modules: [], permissions: user.role?.permissions?.map(p => p.slug) || [] },
      };
    }

    // Owner with hotels → normal multi-hotel flow below
  }

  // ── Validate primary tenant ────────────────────────────────────────────────
  if (user.tenant_id && user.tenant) {
    if (user.tenant.status === TENANT_STATUS.SUSPENDED) {
      throw new AppError('Su suscripción ha expirado. Contacte al administrador.', 403, 'TENANT_SUSPENDED');
    }
    if (user.tenant.status === TENANT_STATUS.INACTIVE) {
      throw new AppError('Esta cuenta ha sido desactivada.', 403, 'TENANT_INACTIVE');
    }
  }

  // ── Multi-hotel check ──────────────────────────────────────────────────────
  const tenants = await _getUserTenants(user.id);

  if (tenants.length <= 1) {
    const effectiveTenantId = tenants.length === 1 ? tenants[0].tenant_id : user.tenant_id;

    let effectiveModules = [];
    let effectivePermissions = [];
    let effectiveRole = user.role?.name;

    if (effectiveTenantId) {
      const ut = await UserTenant.findOne({
        where:   { user_id: user.id, tenant_id: effectiveTenantId, is_active: true },
        include: [
          { model: LocalTenant, as: 'tenant' },
          { model: Role,        as: 'role', include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }] },
        ],
      });
      if (ut) {
        effectiveModules = ut.tenant?.active_modules || [];
        effectivePermissions = ut.role?.permissions?.map(p => p.slug) || [];
        effectiveRole = user.role?.name === 'OWNER' ? 'OWNER' : ut.role?.name;
      }
    } else {
      effectiveModules = user.tenant?.active_modules || [];
      effectivePermissions = user.role?.permissions?.map(p => p.slug) || [];
    }

    const accessToken  = tenants.length === 1
      ? await _issueAccessTokenForTenant(user, effectiveTenantId)
      : _issueAccessToken(user);
    const refreshToken = await _issueRefreshToken(user.id, effectiveTenantId);

    return {
      success: true,
      accessToken,
      refreshToken,
      must_change_password: user.must_change_password,
      user: {
        id:        user.id,
        email:     user.email,
        name:      user.full_name,
        role:      effectiveRole,
        tenant_id: effectiveTenantId,
      },
      tenants, // Added to allow frontend selection even for single-hotel owners
      access: {
        modules:     effectiveModules,
        permissions: effectivePermissions,
      },
    };
  }

  // ── Multiple hotels → selection token ─────────────────────────────────────
  const selectionToken = signAccessToken(
    { userId: user.id, purpose: 'hotel_selection' },
    '5m'
  );

  return {
    success:                  true,
    requires_hotel_selection: true,
    selection_token:          selectionToken,
    user: { id: user.id, email: user.email, name: user.full_name },
    tenants,
  };
}

// ── Switch tenant ─────────────────────────────────────────────────────────────

async function switchTenant(userId, tenantId) {
  const user = await User.findByPk(userId, { include: [{ model: Role, as: 'role' }] });
  if (!user || !user.is_active) throw new AppError('Usuario no válido', 403, 'USER_INACTIVE');

  const accessToken  = await _issueAccessTokenForTenant(user, tenantId);
  const refreshToken = await _issueRefreshToken(userId, tenantId);

  const ut = await UserTenant.findOne({
    where:   { user_id: userId, tenant_id: tenantId, is_active: true },
    include: [
      { model: LocalTenant, as: 'tenant' },
      { model: Role,        as: 'role', include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }] },
    ],
  });

  return {
    success: true,
    accessToken,
    refreshToken,
    must_change_password: user.must_change_password,
    user: {
      id:        user.id,
      email:     user.email,
      name:      user.full_name,
      role:      user.role?.name === 'OWNER' ? 'OWNER' : ut.role?.name,
      tenant_id: tenantId,
    },
    access: {
      modules:     ut.tenant?.active_modules || [],
      permissions: ut.role?.permissions?.map(p => p.slug) || [],
    },
  };
}

// ── Refresh ───────────────────────────────────────────────────────────────────

async function refresh(rawToken) {
  const stored = await RefreshToken.findOne({ where: { token: rawToken, is_revoked: false } });
  if (!stored) throw new AppError('Refresh token inválido', 401, 'INVALID_REFRESH_TOKEN');
  if (new Date() > stored.expires_at) {
    await stored.update({ is_revoked: true });
    throw new AppError('Refresh token expirado', 401, 'REFRESH_TOKEN_EXPIRED');
  }

  const user = await _loadUserWithAccess(stored.user_id);
  if (!user || !user.is_active) throw new AppError('Usuario inactivo', 403, 'USER_INACTIVE');
  if (user.tenant_id && user.tenant?.status !== TENANT_STATUS.ACTIVE) {
    throw new AppError('Tenant suspendido o inactivo', 403, 'TENANT_SUSPENDED');
  }

  await stored.update({ is_revoked: true });
  
  const accessToken  = stored.tenant_id 
    ? await _issueAccessTokenForTenant(user, stored.tenant_id)
    : _issueAccessToken(user);
    
  const refreshToken = await _issueRefreshToken(user.id, stored.tenant_id);
  return { accessToken, refreshToken };
}

// ── Logout ────────────────────────────────────────────────────────────────────

async function logout(rawToken) {
  const stored = await RefreshToken.findOne({ where: { token: rawToken } });
  if (stored) await stored.update({ is_revoked: true });
}

async function logoutAll(userId) {
  await RefreshToken.update({ is_revoked: true }, { where: { user_id: userId, is_revoked: false } });
}

// ── Password ──────────────────────────────────────────────────────────────────

async function changePassword(userId, oldPassword, newPassword) {
  const user = await User.findByPk(userId);
  if (!user) throw new AppError('Usuario no encontrado', 404, 'USER_NOT_FOUND');
  const valid = await bcrypt.compare(oldPassword, user.password_hash);
  if (!valid) throw new AppError('Contraseña actual incorrecta', 400, 'WRONG_PASSWORD');
  const password_hash = await bcrypt.hash(newPassword, 12);
  await user.update({ password_hash, must_change_password: false });
  await logoutAll(userId);
}

async function requestPasswordReset(email) {
  const user = await User.findOne({ where: { email: email.toLowerCase() } });
  if (!user || !user.is_active) return;
  const reset_token         = uuidv4();
  const reset_token_expires = new Date(Date.now() + 60 * 60 * 1000);
  await user.update({ reset_token, reset_token_expires });
  return { user_id: user.id, reset_token };
}

async function resetPassword(token, newPassword) {
  const user = await User.findOne({
    where: { reset_token: token, reset_token_expires: { [Op.gt]: new Date() } },
  });
  if (!user) throw new AppError('Token inválido o expirado', 400, 'INVALID_RESET_TOKEN');
  const password_hash = await bcrypt.hash(newPassword, 12);
  await user.update({ password_hash, reset_token: null, reset_token_expires: null, must_change_password: false });
  await logoutAll(user.id);
}

module.exports = {
  login, switchTenant, refresh, logout, logoutAll,
  changePassword, requestPasswordReset, resetPassword,
};
