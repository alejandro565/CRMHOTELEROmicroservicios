const { publishEvent } = require('../config/rabbitmq');

function publishRoomStatusChanged({ tenant_id, room_id, room_number, floor, prev_status, new_status, changed_by }) {
  publishEvent('room.status_changed', {
    tenant_id, room_id, room_number, floor,
    prev_status, new_status, changed_by,
    occurred_at: new Date().toISOString(),
  });
}

function publishItemDamageReported({ tenant_id, reservation_id, item_name, charge_amount, description }) {
  publishEvent('item.damage_reported', {
    tenant_id, reservation_id, item_name, charge_amount, description,
    timestamp: new Date().toISOString(),
  });
}

function publishInventoryLowAlert({ tenant_id, item_id, available, threshold }) {
  publishEvent('inventory.low_alert', {
    tenant_id, item_id, available, threshold,
    occurred_at: new Date().toISOString(),
  });
}

module.exports = { publishRoomStatusChanged, publishItemDamageReported, publishInventoryLowAlert };
