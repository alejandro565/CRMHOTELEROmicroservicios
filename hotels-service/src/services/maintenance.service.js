const { Room, LendableItem, RoomIncidentLog, MaintenanceLog, ROOM_STATUS, INCIDENT_STATUS } = require('../models');
const AppError = require('../middlewares/AppError');
const { publishEvent } = require('../config/rabbitmq');

/**
 * Report damage on a room.
 * Sets room status → MAINTENANCE and opens a RoomIncidentLog.
 * Optionally fires ITEM_DAMAGE_REPORTED so billing-service can charge the guest.
 */
async function reportDamage({ tenant_id, room_id, item_id, reservation_id, description, reported_by_user_id }) {
  const room = await Room.findOne({ where: { id: room_id, tenant_id } });
  if (!room) throw new AppError('Habitación no encontrada', 404, 'ROOM_NOT_FOUND');

  const t = await Room.sequelize.transaction();
  try {
    // Lock the room
    await room.update({ status: ROOM_STATUS.MAINTENANCE }, { transaction: t });

    const incident = await RoomIncidentLog.create(
      { tenant_id, room_id, item_id: item_id || null, reservation_id: reservation_id || null, description, reported_by_user_id, status: INCIDENT_STATUS.OPEN },
      { transaction: t }
    );

    await t.commit();

    // Notify reception rack
    publishEvent('room.status_changed', {
      tenant_id,
      room_id:     room.id,
      room_number: room.number,
      floor:       room.floor,
      prev_status: ROOM_STATUS.OCCUPIED,
      new_status:  ROOM_STATUS.MAINTENANCE,
      changed_by:  reported_by_user_id,
      occurred_at: new Date().toISOString(),
    });

    // If a specific item is involved, tell billing to charge the guest
    if (item_id && reservation_id) {
      const item = await LendableItem.findByPk(item_id);
      if (item) {
        publishEvent('item.damage_reported', {
          tenant_id,
          reservation_id,
          item_name:    item.name,
          charge_amount: Number(item.replacement_cost),
          description,
          timestamp:    new Date().toISOString(),
        });
      }
    }

    return incident;
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

/**
 * Close a maintenance incident.
 * Moves the incident to maintenance_logs and sets room → CLEAN.
 */
async function closeMaintenance({ tenant_id, incident_id, repair_notes, repair_cost, resolved_by_user_id }) {
  const incident = await RoomIncidentLog.findOne({
    where: { id: incident_id, tenant_id, status: INCIDENT_STATUS.OPEN },
  });
  if (!incident) throw new AppError('Incidente abierto no encontrado', 404, 'INCIDENT_NOT_FOUND');

  const room = await Room.findByPk(incident.room_id);

  const t = await Room.sequelize.transaction();
  try {
    // 1. Close the incident
    await incident.update({ status: INCIDENT_STATUS.RESOLVED }, { transaction: t });

    // 2. Create historical record
    await MaintenanceLog.create(
      {
        tenant_id,
        incident_id: incident.id,
        room_id:     incident.room_id,
        resolved_by_user_id,
        repair_notes,
        repair_cost:  repair_cost || 0,
        resolved_at:  new Date(),
      },
      { transaction: t }
    );

    // 3. Check if there are other open incidents for this room
    const remainingOpen = await RoomIncidentLog.count({
      where: { room_id: incident.room_id, status: INCIDENT_STATUS.OPEN, id: { [require('sequelize').Op.ne]: incident_id } },
      transaction: t,
    });

    // Only release room if no other open incidents remain
    if (remainingOpen === 0) {
      await room.update({ status: ROOM_STATUS.DIRTY }, { transaction: t });
    }

    await t.commit();

    if (remainingOpen === 0) {
      publishEvent('room.status_changed', {
        tenant_id,
        room_id:     room.id,
        room_number: room.number,
        floor:       room.floor,
        prev_status: ROOM_STATUS.MAINTENANCE,
        new_status:  ROOM_STATUS.DIRTY,
        changed_by:  resolved_by_user_id,
        occurred_at: new Date().toISOString(),
      });
    }

    return { incident_id, resolved: true, room_released: remainingOpen === 0 };
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

async function listOpenIncidents(tenant_id, room_id) {
  const where = { tenant_id, status: INCIDENT_STATUS.OPEN };
  if (room_id) where.room_id = room_id;
  return RoomIncidentLog.findAll({
    where,
    include: [{ model: Room, as: 'room', attributes: ['id', 'number', 'floor'] }],
    order: [['created_at', 'DESC']],
  });
}

async function listMaintenanceLogs(tenant_id, room_id) {
  const where = { tenant_id };
  if (room_id) where.room_id = room_id;
  return MaintenanceLog.findAll({ where, order: [['resolved_at', 'DESC']] });
}

module.exports = { reportDamage, closeMaintenance, listOpenIncidents, listMaintenanceLogs };
