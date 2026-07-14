const axios = require('axios');
const AppError = require('../middlewares/AppError');

const client = axios.create({
  baseURL: process.env.GUEST_SERVICE_URL || 'http://guest-service:3004',
  timeout: 5000,
  headers: { 'x-internal-token': process.env.INTERNAL_TOKEN },
});

/**
 * Fetch guest profile + best discount applicable.
 * Used during reservation creation to calculate the final price.
 */
async function validateGuest(guestId, tenantId) {
  try {
    const { data } = await client.get(`/internal/guests/validate/${guestId}`, {
      params: { tenant_id: tenantId },
    });
    return data; // { guest_id, full_name, loyalty, best_discount, is_profile_complete }
  } catch (err) {
    if (err.response?.status === 404) throw new AppError('Huésped no encontrado', 404, 'GUEST_NOT_FOUND');
    throw new AppError(`guest-service no disponible: ${err.message}`, 502, 'GUEST_SERVICE_ERROR');
  }
}

async function updateGuestProfile(guestId, tenantId, data) {
  try {
    const { data: result } = await client.patch(`/internal/guests/${guestId}`, data, {
      params: { tenant_id: tenantId },
    });
    return result.data;
  } catch (err) {
    throw new AppError(`Error al actualizar huésped: ${err.message}`, 502);
  }
}

async function createGuestInternal(tenantId, data) {
  try {
    const { data: result } = await client.post('/internal/guests', data, {
      params: { tenant_id: tenantId },
    });
    return result.data;
  } catch (err) {
    const status = err.response?.status || 502;
    const msg = err.response?.data?.message || err.message;
    console.error(`[guestClient] Error ${status}: ${msg}`);
    throw new AppError(`Error en guest-service (${status}): ${msg}`, status);
  }
}

module.exports = { validateGuest, updateGuestProfile, createGuestInternal };
