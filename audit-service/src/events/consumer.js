const { getChannel }  = require('../config/rabbitmq');
const { ingestLog }   = require('../services/audit.service');

const EXCHANGE = process.env.RABBITMQ_EXCHANGE || 'hotel_events';
const QUEUE    = 'audit_service_events';

/**
 * Wildcard binding — audit captures every event on the exchange.
 * Individual handlers normalize the payload into the ActivityLog schema.
 */
const BINDINGS = [
  'tenant.provisioned', 'tenant.suspended', 'tenant.deleted',
  'reservation.created', 'reservation.checkin', 'reservation.checkout',
  'billing.folio_cleared', 'billing.shift_closed', 'billing.invoice_generated',
  'guest.merged',
  'loyalty.level_up',
  'room.status_changed',
  'data.changed',   // generic DATA_CHANGED event from any service
];

/**
 * Map a RabbitMQ routing key to a normalized audit entry.
 * Returns null to silently skip keys that don't need logging.
 */
function normalize(routingKey, payload) {
  const base = {
    tenant_id:   payload.tenant_id   || null,
    user_id:     payload.user_id     || null,
    ip_address:  payload.ip_address  || null,
    user_agent:  payload.user_agent  || null,
    occurred_at: payload.occurred_at || payload.timestamp || new Date().toISOString(),
  };

  switch (routingKey) {
    // ── SaaS lifecycle ────────────────────────────────────────────────────
    case 'tenant.provisioned':
      return { ...base, action: 'CREATE', module: 'SAAS', entity_id: payload.tenant_id };
    case 'tenant.suspended':
      return { ...base, action: 'UPDATE', module: 'SAAS', entity_id: payload.tenant_id,
        payload: { after: { status: 'SUSPENDED', reason: payload.reason } } };
    case 'tenant.deleted':
      return { ...base, action: 'DELETE', module: 'SAAS', entity_id: payload.tenant_id };

    // ── Reservations ──────────────────────────────────────────────────────
    case 'reservation.created':
      return { ...base, action: 'CREATE', module: 'RESERVATIONS', entity_id: payload.reservation_id };
    case 'reservation.checkin':
      return { ...base, action: 'UPDATE', module: 'RESERVATIONS', entity_id: payload.reservation_id,
        payload: { after: { status: 'IN_HOUSE', room_id: payload.room_id } } };
    case 'reservation.checkout':
      return { ...base, action: 'UPDATE', module: 'RESERVATIONS', entity_id: payload.reservation_id,
        payload: { after: { status: 'CHECKED_OUT', amount_spent: payload.amount_spent } } };

    // ── Billing ───────────────────────────────────────────────────────────
    case 'billing.folio_cleared':
      return { ...base, action: 'UPDATE', module: 'BILLING', entity_id: payload.folio_id,
        payload: { after: { balance: 0, reservation_id: payload.reservation_id } } };
    case 'billing.shift_closed':
      return { ...base, action: 'UPDATE', module: 'BILLING', entity_id: payload.shift_id,
        user_id: payload.user_id,
        payload: { after: { expected_cash: payload.expected_cash, actual_cash: payload.actual_cash, difference: payload.difference } } };
    case 'billing.invoice_generated':
      return { ...base, action: 'CREATE', module: 'BILLING', entity_id: payload.invoice_id };

    // ── Guests ────────────────────────────────────────────────────────────
    case 'guest.merged':
      return { ...base, action: 'DELETE', module: 'GUESTS', entity_id: payload.duplicate_guest_id,
        payload: { after: { merged_into: payload.main_guest_id } } };
    case 'loyalty.level_up':
      return { ...base, action: 'UPDATE', module: 'GUESTS', entity_id: payload.guest_id,
        payload: { after: { loyalty_level: payload.new_level, total_stays: payload.total_stays } } };

    // ── Hotels ────────────────────────────────────────────────────────────
    case 'room.status_changed':
      return { ...base, action: 'UPDATE', module: 'HOTELS', entity_id: payload.room_id,
        user_id: payload.changed_by,
        payload: { before: { status: payload.prev_status }, after: { status: payload.new_status } } };

    // ── Generic DATA_CHANGED ──────────────────────────────────────────────
    case 'data.changed':
      return {
        ...base,
        action:    payload.action  || 'UPDATE',
        module:    payload.module  || 'RESERVATIONS',
        entity_id: payload.entity_id || null,
        payload:   payload.payload || {},
      };

    default:
      return null;
  }
}

async function dispatch(routingKey, payload) {
  const entry = normalize(routingKey, payload);
  if (!entry) return;
  await ingestLog(entry);
}

async function startConsumers() {
  const channel = getChannel();
  if (!channel) { console.error('[Consumer] channel not available'); return; }

  await channel.assertQueue(QUEUE, { durable: true });
  for (const key of BINDINGS) await channel.bindQueue(QUEUE, EXCHANGE, key);

  channel.prefetch(5); // audit can process a few in parallel — it's append-only

  channel.consume(QUEUE, async (msg) => {
    if (!msg) return;
    const routingKey = msg.fields.routingKey;
    let payload;
    try { payload = JSON.parse(msg.content.toString()); }
    catch { channel.nack(msg, false, false); return; }
    try {
      await dispatch(routingKey, payload);
      channel.ack(msg);
    } catch (err) {
      console.error(`[Consumer] error on ${routingKey}:`, err.message);
      channel.nack(msg, false, !msg.fields.redelivered);
    }
  });

  console.log(`[Consumer] audit listening on queue: ${QUEUE} (${BINDINGS.length} bindings)`);
}

module.exports = { startConsumers };
