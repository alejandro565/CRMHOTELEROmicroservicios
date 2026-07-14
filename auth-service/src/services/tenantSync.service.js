const { LocalTenant, User, UserTenant, TENANT_STATUS } = require('../models');
const { logoutAll } = require('./auth.service');

/**
 * Handles TENANT_SUSPENDED event.
 * Marks the local tenant copy as SUSPENDED and revokes all active refresh tokens
 * for every user linked to that tenant — forcing re-login (which will be rejected).
 */
async function syncTenantSuspended({ tenant_id, reason }) {
  const tenant = await LocalTenant.findByPk(tenant_id);
  if (!tenant) {
    console.warn(`[TenantSync] SUSPENDED — tenant ${tenant_id} not found locally`);
    return;
  }

  await tenant.update({ status: TENANT_STATUS.SUSPENDED });

  // Revoke sessions for all users linked to this tenant (primary + multi-hotel)
  const links = await UserTenant.findAll({ where: { tenant_id } });
  await Promise.all(links.map((ut) => logoutAll(ut.user_id)));

  console.log(`[TenantSync] tenant ${tenant_id} suspended — ${links.length} sessions revoked. Reason: ${reason}`);
}

/**
 * Handles TENANT_PLAN_CHANGED event.
 * Updates max_hotels, max_rooms_per_hotel and active_modules so the next
 * JWT refresh carries the updated feature set.
 */
async function syncTenantPlanChanged({ tenant_id, new_config }) {
  const tenant = await LocalTenant.findByPk(tenant_id);
  if (!tenant) {
    console.warn(`[TenantSync] PLAN_CHANGED — tenant ${tenant_id} not found locally`);
    return;
  }

  await tenant.update({
    active_modules:      new_config.modules              || [],
    max_hotels:          new_config.max_hotels          ?? tenant.max_hotels,
    max_rooms_per_hotel: new_config.max_rooms_per_hotel ?? tenant.max_rooms_per_hotel,
  });

  console.log(`[TenantSync] tenant ${tenant_id} plan updated — modules: ${(new_config.modules || []).join(', ')}`);
}

/**
 * Handles TENANT_DELETED event.
 * Marks tenant as INACTIVE and revokes all linked sessions.
 */
async function syncTenantDeleted({ tenant_id }) {
  const tenant = await LocalTenant.findByPk(tenant_id);
  if (!tenant) return;

  await tenant.update({ status: TENANT_STATUS.INACTIVE });

  const links = await UserTenant.findAll({ where: { tenant_id } });
  await Promise.all(links.map((ut) => logoutAll(ut.user_id)));

  console.log(`[TenantSync] tenant ${tenant_id} deleted — ${links.length} sessions revoked`);
}

/**
 * Handles TENANT_UPDATED event.
 * Syncs hotel name and other general properties.
 */
async function syncTenantUpdated({ tenant_id, name }) {
  const tenant = await LocalTenant.findByPk(tenant_id);
  if (!tenant) return;

  await tenant.update({ hotel_name: name || tenant.hotel_name });

  console.log(`[TenantSync] tenant ${tenant_id} updated: ${name}`);
}

module.exports = { syncTenantSuspended, syncTenantPlanChanged, syncTenantDeleted, syncTenantUpdated };
