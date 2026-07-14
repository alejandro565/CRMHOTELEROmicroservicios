const axios = require('axios');
const AppError = require('../middlewares/AppError');

const client = axios.create({
  baseURL: process.env.HOTELS_SERVICE_URL || 'http://hotels-service:3003',
  timeout: 6000,
  headers: { 'x-internal-token': process.env.INTERNAL_TOKEN },
});

/**
 * Validate that a physical room is CLEAN and can receive a guest.
 * Called before processCheckIn or assignPhysicalRoom.
 */
async function validateRoomForCheckin(roomId, tenantId) {
  try {
    const { data } = await client.get(`/internal/rooms/${roomId}/validate-checkin`, {
      params: { tenant_id: tenantId },
    });
    return data; // { room_id, can_checkin, current_status, reason? }
  } catch (err) {
    if (err.response?.status === 404) throw new AppError('Habitación no encontrada en hotels-service', 404, 'ROOM_NOT_FOUND');
    throw new AppError(`hotels-service no disponible: ${err.message}`, 502, 'HOTELS_SERVICE_ERROR');
  }
}

/**
 * Mark a physical room as OCCUPIED after check-in,
 * or DIRTY after check-out.
 */
async function setRoomStatus(roomId, tenantId, status) {
  try {
    await client.patch(`/internal/rooms/${roomId}/status`, { tenant_id: tenantId, status });
  } catch (err) {
    // Log but don't fail the reservation operation — RabbitMQ event is the primary mechanism
    console.error(`[HotelsClient] setRoomStatus failed for room ${roomId}:`, err.message);
  }
}

/**
 * Get all physical rooms of a category. Used for conflict detection overlap.
 */
async function getPhysicalRooms(tenantId, roomTypeId) {
  try {
    const { data } = await client.get(`/internal/rooms`, {
      params: { tenant_id: tenantId, room_type_id: roomTypeId },
    });
    return data.data || [];
  } catch (err) {
    throw new AppError(`hotels-service no disponible: ${err.message}`, 502, 'HOTELS_SERVICE_ERROR');
  }
}

async function adjustInventory(itemId, tenantId, qty, reason) {
  try {
    await client.patch(`/internal/inventory/${itemId}/adjust`, { tenant_id: tenantId, qty, reason });
  } catch (err) {
    console.error(`[HotelsClient] adjustInventory failed for item ${itemId}:`, err.message);
  }
}

/**
 * Get a lendable item's details including replacement_cost.
 * Called at lending time to snapshot the cost into StayLoan.
 */
async function getItemDetails(itemId, tenantId) {
  try {
    const { data } = await client.get(`/internal/items/${itemId}`, {
      params: { tenant_id: tenantId },
    });
    return data; // { id, name, replacement_cost, ... }
  } catch (err) {
    console.error(`[HotelsClient] getItemDetails failed for item ${itemId}:`, err.message);
    return null;
  }
}

module.exports = { validateRoomForCheckin, setRoomStatus, getPhysicalRooms, adjustInventory, getItemDetails };
