const axios = require('axios');
const AppError = require('../middlewares/AppError');

const authClient = axios.create({
  baseURL: process.env.AUTH_SERVICE_URL || 'http://auth-service:3002',
  timeout: 8000,
  headers: {
    'Content-Type':     'application/json',
    'x-internal-token': process.env.AUTH_SERVICE_INTERNAL_TOKEN,
  },
});

/**
 * Called when provisioning the FIRST hotel for a new owner.
 * Creates the LocalTenant mirror in auth-service and links the Owner user to it.
 * Returns the owner's user_id so saas-service can store it as owner_id in tenants.
 */
async function setupTenantForOwner({
  tenant_id,
  owner_id,
  hotel_name,
  plan_name,
  max_hotels,
  max_rooms_per_hotel,
  active_modules,
}) {
  const payload = {
    tenant_id,
    owner_id,           // auth-service uses this to find the user instead of email
    hotel_name,
    tenant_config: {
      plan_name,
      max_hotels,
      max_rooms_per_hotel,
      active_modules,
    },
    metadata: {
      reason:     'owner_add_hotel',
      created_at: new Date().toISOString(),
    },
  };

  try {
    const response = await authClient.post('/internal/setup-tenant-for-owner', payload);
    return response.data;
  } catch (err) {
    const status  = err.response?.status;
    const message = err.response?.data?.message || err.message;
    const code    = err.response?.data?.code;

    if (code === 'ALREADY_LINKED') return err.response.data;

    throw new AppError(
      `auth-service no disponible: ${message}`,
      status === 502 ? 502 : 502,
      'AUTH_SERVICE_ERROR'
    );
  }
}

/**
 * Legacy — kept for backward compatibility with existing tenants
 * that were created before the owner_id field was added.
 * Only called from setupInitialAdmin in user.service.
 */
async function setupTenantAdmin({
  tenant_id, email, full_name, plan_name,
  max_hotels, max_rooms_per_hotel, active_modules,
}) {
  const payload = {
    tenant_id,
    admin_user: {
      email,
      full_name,
      initial_password: `${process.env.INITIAL_ADMIN_PASSWORD_PREFIX || 'TempPass!'}${tenant_id.slice(0, 8)}`,
      must_change_password: true,
    },
    tenant_config: { plan_name, max_hotels, max_rooms_per_hotel, active_modules },
    metadata: { reason: 'new_onboarding', created_at: new Date().toISOString() },
  };

  try {
    const response = await authClient.post('/internal/setup-admin', payload);
    return response.data;
  } catch (err) {
    const status  = err.response?.status;
    const message = err.response?.data?.message || err.message;
    const code    = err.response?.data?.code;
    if (code === 'ALREADY_LINKED') return err.response.data;
    if (status === 409) throw new AppError(`El email ya está registrado: ${message}`, 409, 'EMAIL_IN_USE');
    throw new AppError(`auth-service no disponible: ${message}`, 502, 'AUTH_SERVICE_ERROR');
  }
}

module.exports = { setupTenantForOwner, setupTenantAdmin };
