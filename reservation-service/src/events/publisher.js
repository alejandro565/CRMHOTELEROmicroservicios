const { publishEvent } = require('../config/rabbitmq');

function publishReservationCreated({ tenant_id, reservation_id, status, guest_id, total_price, rooms }) {
  publishEvent('reservation.created', {
    tenant_id, reservation_id, status, guest_id, total_price,
    rooms, // [{ room_type_id, check_in_date, check_out_date, rate_per_night }]
    occurred_at: new Date().toISOString(),
  });
}

function publishCheckinCompleted({ tenant_id, reservation_id, room_id, room_number, guest_id }) {
  publishEvent('reservation.checkin', {
    tenant_id, reservation_id, room_id, room_number, guest_id,
    occurred_at: new Date().toISOString(),
  });
}

function publishCheckoutCompleted({ tenant_id, reservation_id, room_id, guest_id, amount_spent }) {
  publishEvent('reservation.checkout', {
    tenant_id, reservation_id, room_id, guest_id, amount_spent,
    occurred_at: new Date().toISOString(),
  });
}

function publishStayExtended({ tenant_id, reservation_id, res_room_id, new_checkout, extra_nights, extra_charge }) {
  publishEvent('reservation.stay_extended', {
    tenant_id, reservation_id, res_room_id, new_checkout, extra_nights, extra_charge,
    occurred_at: new Date().toISOString(),
  });
}

function publishRoomAlertNeeded({ tenant_id, rooms_arriving_tomorrow }) {
  publishEvent('reservation.room_alert', {
    tenant_id,
    rooms_arriving_tomorrow, // [{ room_id, room_number, reservation_id }]
    alert_date: new Date().toISOString(),
  });
}

module.exports = {
  publishReservationCreated,
  publishCheckinCompleted,
  publishCheckoutCompleted,
  publishStayExtended,
  publishRoomAlertNeeded,
};
