const { Room, RoomType, RoomIncidentLog, LendableItem, ItemInventory, ROOM_STATUS } = require('../models');
const AppError = require('../middlewares/AppError');
const { publishEvent } = require('../config/rabbitmq');

// ─── CRUD ─────────────────────────────────────────────────────────────────────

async function createRoom({ tenant_id, room_type_id, number, floor, notes }) {
  // Validate room_type belongs to tenant
  const roomType = await RoomType.findOne({ where: { id: room_type_id, tenant_id } });
  if (!roomType) throw new AppError('Tipo de habitación no encontrado', 404, 'ROOM_TYPE_NOT_FOUND');

  const exists = await Room.findOne({ where: { tenant_id, number } });
  if (exists) throw new AppError(`La habitación ${number} ya existe`, 409, 'ROOM_NUMBER_EXISTS');

  const room = await Room.create({ tenant_id, room_type_id, number, floor, status: ROOM_STATUS.CLEAN, notes });
  await _syncKeysInventory(tenant_id);
  return room;
}

/**
 * Utility: bulk-create rooms using a prefix, starting number, and count.
 * E.g. prefix="1", start=01, count=10 → creates rooms 101, 102, ..., 110
 */
async function massCreateRooms({ tenant_id, room_type_id, prefix = '', start, count }) {
  if (count <= 0) throw new AppError('La cantidad debe ser mayor a 0', 400, 'INVALID_COUNT');
  if (count > 100) throw new AppError('Máximo 100 habitaciones por lote', 400, 'COUNT_TOO_HIGH');

  const roomType = await RoomType.findOne({ where: { id: room_type_id, tenant_id } });
  if (!roomType) throw new AppError('Tipo de habitación no encontrado', 404, 'ROOM_TYPE_NOT_FOUND');

  // Prefix is usually the floor. If it's numeric, we store it as floor.
  const floor = isNaN(prefix) ? 0 : parseInt(prefix);
  
  const records = [];
  for (let i = 0; i < count; i++) {
    const currentNum = start + i;
    // Format number: prefix + currentNum (padded or direct)
    // E.g. prefix="1", start=1 -> "11", prefix="1", start=01 (if passed as string) -> difficult with parseInt
    // We will simple concat prefix + currentNum for now.
    const number = `${prefix}${currentNum}`;
    
    records.push({ 
      tenant_id, 
      room_type_id, 
      floor, 
      number, 
      status: ROOM_STATUS.CLEAN 
    });
  }

  // ignoreDuplicates: true allows skipping existing rooms instead of failing entire batch
  const created = await Room.bulkCreate(records, { ignoreDuplicates: true });
  await _syncKeysInventory(tenant_id);
  return { requested: records.length, created: created.length };
}

async function listRooms(tenant_id, { status, floor, room_type_id } = {}) {
  const where = { tenant_id };
  if (status) where.status = status;
  if (floor !== undefined) where.floor = floor;
  if (room_type_id) where.room_type_id = room_type_id;

  const rooms = await Room.findAll({
    where,
    include: [{ model: RoomType, as: 'room_type', attributes: ['id', 'name', 'base_price'] }],
    order: [['floor', 'ASC'], ['number', 'ASC']],
  });

  return rooms.map(r => {
    const json = r.toJSON();
    return {
      ...json,
      room_type_name: json.room_type?.name
    };
  });
}

async function getRoom(id, tenant_id) {
  const room = await Room.findOne({
    where: { id, tenant_id },
    include: [
      { model: RoomType, as: 'room_type' },
      {
        model: RoomIncidentLog, as: 'incidents',
        where: { status: 'OPEN' },
        required: false,
      },
    ],
  });
  if (!room) throw new AppError('Habitación no encontrada', 404, 'ROOM_NOT_FOUND');

  const json = room.toJSON();
  return {
    ...json,
    room_type_name: json.room_type?.name
  };
}

async function updateRoom(id, tenant_id, data) {
  const room = await _getRoom(id, tenant_id);
  // Prevent manually moving to MAINTENANCE via this endpoint
  if (data.status === ROOM_STATUS.MAINTENANCE) {
    throw new AppError('Use el endpoint de reporte de daños para poner en mantenimiento', 400, 'USE_INCIDENT_ENDPOINT');
  }
  await room.update(data);
  return room;
}

async function deleteRoom(id, tenant_id) {
  const room = await _getRoom(id, tenant_id);
  if (room.status === ROOM_STATUS.OCCUPIED) {
    throw new AppError('No se puede eliminar una habitación ocupada', 409, 'ROOM_OCCUPIED');
  }
  await room.destroy();
  await _syncKeysInventory(tenant_id);
  return { deleted: true, id };
}

// ─── Status ───────────────────────────────────────────────────────────────────

/**
 * Manual status change by housekeeping staff.
 * Cannot transition FROM or TO MAINTENANCE — that goes through incidents.
 */
async function updateRoomStatus(id, tenant_id, newStatus, changedByUserId) {
  const room = await _getRoom(id, tenant_id);

  if (room.status === ROOM_STATUS.MAINTENANCE) {
    throw new AppError(
      'La habitación está en mantenimiento. Cierre el incidente primero.',
      409, 'ROOM_IN_MAINTENANCE'
    );
  }
  if (newStatus === ROOM_STATUS.MAINTENANCE) {
    throw new AppError('Use el endpoint de reporte de daños', 400, 'USE_INCIDENT_ENDPOINT');
  }

  const prevStatus = room.status;
  await room.update({ status: newStatus });

  // Notify the reception rack in real time
  publishEvent('room.status_changed', {
    tenant_id,
    room_id:      room.id,
    room_number:  room.number,
    floor:        room.floor,
    prev_status:  prevStatus,
    new_status:   newStatus,
    changed_by:   changedByUserId,
    occurred_at:  new Date().toISOString(),
  });

  return room;
}

// ─── Private ──────────────────────────────────────────────────────────────────

async function _getRoom(id, tenant_id) {
  const room = await Room.findOne({ where: { id, tenant_id } });
  if (!room) throw new AppError('Habitación no encontrada', 404, 'ROOM_NOT_FOUND');
  return room;
}

/**
 * Automatically syncs the "Room Key" inventory with the total room count.
 */
async function _syncKeysInventory(tenant_id) {
  try {
    const item = await LendableItem.findOne({ 
      where: { tenant_id, name: { [require('sequelize').Op.iLike]: '%llave%' } } 
    });
    if (!item) return;

    const count = await Room.count({ where: { tenant_id } });
    
    // We update total_qty to match room count. 
    // available_qty is also bumped if it was zero or less than new total.
    const inv = await ItemInventory.findOne({ where: { tenant_id, item_id: item.id } });
    if (inv) {
      const diff = count - inv.total_qty;
      if (diff === 0) return;

      await inv.update({
        total_qty: count,
        available_qty: Math.max(0, inv.available_qty + diff)
      });
    }
  } catch (err) {
    console.error('[RoomService] Failed to sync keys inventory:', err.message);
  }
}

module.exports = {
  createRoom,
  massCreateRooms,
  listRooms,
  getRoom,
  updateRoom,
  deleteRoom,
  updateRoomStatus,
};
