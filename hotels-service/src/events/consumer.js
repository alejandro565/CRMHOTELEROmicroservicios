const { getChannel }     = require('../config/rabbitmq');
const { HotelSettings, Room, ROOM_STATUS } = require('../models');
const { upsertSettings } = require('../services/settings.service');

const EXCHANGE = process.env.RABBITMQ_EXCHANGE || 'hotel_events';
const QUEUE    = 'hotels_service_events';

const BINDINGS = [
  'tenant.provisioned',
  'reservation.checkout',
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * TENANT_PROVISIONED — saas-service tells us a new hotel was created.
 * We bootstrap the hotel_settings row so the hotel isn't empty on first login.
 */
async function handleTenantProvisioned(payload) {
  const { tenant_id, plan_config, plan_max_rooms } = payload;

  // plan_config.max_rooms (from TENANT_PROVISIONED event shape in saas-service)
  const maxRooms = plan_max_rooms ?? plan_config?.max_rooms ?? 0;

  await upsertSettings(tenant_id, {
    plan_max_rooms: maxRooms,
    currency: payload.default_currency || 'BOB',
  });

  console.log(`[Consumer] hotel ${tenant_id} initialised — max_rooms: ${maxRooms}`);
}

/**
 * RESERVATION_CHECKOUT — reservation-service signals a guest checked out.
 * Automatically marks the room as DIRTY so housekeeping queues it.
 */
async function handleReservationCheckout(payload) {
  const { tenant_id, room_id } = payload;

  const room = await Room.findOne({ where: { id: room_id, tenant_id } });
  if (!room) {
    console.warn(`[Consumer] CHECKOUT — room ${room_id} not found for tenant ${tenant_id}`);
    return;
  }

  if (room.status === ROOM_STATUS.MAINTENANCE) {
    console.log(`[Consumer] room ${room_id} already in MAINTENANCE — skipping DIRTY transition`);
    return;
  }

  await room.update({ status: ROOM_STATUS.DIRTY });
  console.log(`[Consumer] room ${room_id} → DIRTY after checkout`);
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

async function dispatch(routingKey, payload) {
  switch (routingKey) {
    case 'tenant.provisioned':    return handleTenantProvisioned(payload);
    case 'reservation.checkout':  return handleReservationCheckout(payload);
    default:
      console.warn(`[Consumer] unhandled routing key: ${routingKey}`);
  }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function startConsumers() {
  const channel = getChannel();
  if (!channel) { console.error('[Consumer] RabbitMQ channel not available'); return; }

  await channel.assertQueue(QUEUE, { durable: true });
  for (const key of BINDINGS) await channel.bindQueue(QUEUE, EXCHANGE, key);

  channel.prefetch(1);

  channel.consume(QUEUE, async (msg) => {
    if (!msg) return;
    const routingKey = msg.fields.routingKey;
    let payload;
    try {
      payload = JSON.parse(msg.content.toString());
    } catch {
      console.error(`[Consumer] invalid JSON on ${routingKey}`);
      channel.nack(msg, false, false);
      return;
    }
    try {
      console.log(`[Consumer] received → ${routingKey}`);
      await dispatch(routingKey, payload);
      channel.ack(msg);
    } catch (err) {
      console.error(`[Consumer] error on ${routingKey}:`, err.message);
      channel.nack(msg, false, !msg.fields.redelivered);
    }
  });

  console.log(`[Consumer] listening on queue: ${QUEUE}`);
}

module.exports = { startConsumers };
