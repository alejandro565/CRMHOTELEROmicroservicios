const { getChannel }          = require('../config/rabbitmq');
const { GuestStats }          = require('../models');
const { recalculateGuestLoyalty, seedDefaultLevel } = require('../services/loyalty.service');

const EXCHANGE = process.env.RABBITMQ_EXCHANGE || 'hotel_events';
const QUEUE    = 'guest_service_events';
const BINDINGS = ['reservation.checkout', 'tenant.provisioned'];

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * RESERVATION_CHECKOUT — update stats and recalculate loyalty.
 * Payload: { tenant_id, guest_id, amount_spent, checked_out_at }
 */
async function handleCheckout({ tenant_id, guest_id, amount_spent = 0 }) {
  const stats = await GuestStats.findOne({ where: { guest_id, tenant_id } });
  if (!stats) {
    console.warn(`[Consumer] CHECKOUT — stats not found for guest ${guest_id}`);
    return;
  }

  await stats.update({
    total_stays: stats.total_stays + 1,
    total_spent: Number(stats.total_spent) + Number(amount_spent),
    last_visit_at: new Date(),
  });

  await recalculateGuestLoyalty(guest_id, tenant_id);
  console.log(`[Consumer] guest ${guest_id} stats updated — total_stays: ${stats.total_stays + 1}`);
}

/**
 * TENANT_PROVISIONED — seed the default loyalty level for the new hotel.
 */
async function handleTenantProvisioned({ tenant_id }) {
  await seedDefaultLevel(tenant_id);
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

async function dispatch(routingKey, payload) {
  switch (routingKey) {
    case 'reservation.checkout': return handleCheckout(payload);
    case 'tenant.provisioned':   return handleTenantProvisioned(payload);
    default: console.warn(`[Consumer] unhandled key: ${routingKey}`);
  }
}

async function startConsumers() {
  const channel = getChannel();
  if (!channel) { console.error('[Consumer] channel not available'); return; }

  await channel.assertQueue(QUEUE, { durable: true });
  for (const key of BINDINGS) await channel.bindQueue(QUEUE, EXCHANGE, key);

  channel.prefetch(1);
  channel.consume(QUEUE, async (msg) => {
    if (!msg) return;
    const routingKey = msg.fields.routingKey;
    let payload;
    try { payload = JSON.parse(msg.content.toString()); }
    catch { channel.nack(msg, false, false); return; }
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
