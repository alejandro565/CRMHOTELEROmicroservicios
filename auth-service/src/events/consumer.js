const { getChannel } = require('../config/rabbitmq');
const {
  syncTenantSuspended,
  syncTenantPlanChanged,
  syncTenantDeleted,
  syncTenantUpdated,
} = require('../services/tenantSync.service');

const EXCHANGE = process.env.RABBITMQ_EXCHANGE || 'hotel_events';
const QUEUE    = 'auth_service_events';

// Routing keys this service cares about
const BINDINGS = [
  'tenant.suspended',
  'tenant.plan_changed',
  'tenant.deleted',
  'tenant.updated',
];

/**
 * Dispatch an incoming event to the right handler.
 */
async function dispatch(routingKey, payload) {
  switch (routingKey) {
    case 'tenant.suspended':
      return syncTenantSuspended(payload);
    case 'tenant.plan_changed':
      return syncTenantPlanChanged(payload);
    case 'tenant.deleted':
      return syncTenantDeleted(payload);
    case 'tenant.updated':
      return syncTenantUpdated(payload);
    default:
      console.warn(`[Consumer] unhandled routing key: ${routingKey}`);
  }
}

async function startConsumers() {
  const channel = getChannel();
  if (!channel) {
    console.error('[Consumer] RabbitMQ channel not available');
    return;
  }

  // Durable queue so messages survive broker restarts
  await channel.assertQueue(QUEUE, { durable: true });

  for (const key of BINDINGS) {
    await channel.bindQueue(QUEUE, EXCHANGE, key);
  }

  // Process one message at a time (prefetch = 1)
  channel.prefetch(1);

  channel.consume(QUEUE, async (msg) => {
    if (!msg) return;

    const routingKey = msg.fields.routingKey;
    let payload;

    try {
      payload = JSON.parse(msg.content.toString());
    } catch {
      console.error(`[Consumer] invalid JSON on ${routingKey}`);
      channel.nack(msg, false, false); // discard malformed message
      return;
    }

    try {
      console.log(`[Consumer] received → ${routingKey}`);
      await dispatch(routingKey, payload);
      channel.ack(msg);
    } catch (err) {
      console.error(`[Consumer] error processing ${routingKey}:`, err.message);
      // Requeue once, then send to dead-letter if it fails again
      channel.nack(msg, false, !msg.fields.redelivered);
    }
  });

  console.log(`[Consumer] listening on queue: ${QUEUE}`);
}

module.exports = { startConsumers };
