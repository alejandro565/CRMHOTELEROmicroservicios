const { getChannel } = require('../config/rabbitmq');
const { Reservation } = require('../models');

const EXCHANGE = process.env.RABBITMQ_EXCHANGE || 'hotel_events';
const QUEUE = 'reservation_service_billing_sync';
const BINDINGS = ['billing.balance_updated'];

async function handleBalanceUpdated({ tenant_id, reservation_id, total_balance }) {
  try {
    const reservation = await Reservation.findOne({
      where: { id: reservation_id, tenant_id }
    });

    if (reservation) {
      await reservation.update({ pending_balance: total_balance });
      console.log(`[Consumer] Updated reservation ${reservation_id} balance to ${total_balance}`);
    } else {
      console.warn(`[Consumer] Reservation ${reservation_id} not found for balance update`);
    }
  } catch (err) {
    console.error(`[Consumer] Error updating reservation ${reservation_id} balance:`, err.message);
    throw err; // Re-throw to allow RabbitMQ retry
  }
}

async function dispatch(routingKey, payload) {
  switch (routingKey) {
    case 'billing.balance_updated':
      return handleBalanceUpdated(payload);
    default:
      console.warn(`[Consumer] Unhandled routing key: ${routingKey}`);
  }
}

async function startConsumers() {
  const channel = getChannel();
  if (!channel) {
    console.error('[Consumer] RabbitMQ channel not available');
    return;
  }

  await channel.assertQueue(QUEUE, { durable: true });
  for (const key of BINDINGS) {
    await channel.bindQueue(QUEUE, EXCHANGE, key);
  }

  channel.prefetch(1);
  channel.consume(QUEUE, async (msg) => {
    if (!msg) return;

    const routingKey = msg.fields.routingKey;
    let payload;

    try {
      payload = JSON.parse(msg.content.toString());
    } catch (err) {
      console.error('[Consumer] Payload parse error:', err.message);
      channel.nack(msg, false, false);
      return;
    }

    try {
      await dispatch(routingKey, payload);
      channel.ack(msg);
    } catch (err) {
      console.error(`[Consumer] Dispatch error for ${routingKey}:`, err.message);
      // Nack with requeue if it's the first time
      channel.nack(msg, false, !msg.fields.redelivered);
    }
  });

  console.log(`[Consumer] Listening for billing events on queue: ${QUEUE}`);
}

module.exports = { startConsumers };
