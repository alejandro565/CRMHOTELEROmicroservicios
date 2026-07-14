const amqp = require('amqplib');

let channel = null;
const EXCHANGE = process.env.RABBITMQ_EXCHANGE || 'hotel_events';

async function connectRabbitMQ(retries = 5, delay = 4000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const conn = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
      channel = await conn.createChannel();

      // topic exchange: routing_key = "tenant.provisioned", "tenant.suspended", etc.
      await channel.assertExchange(EXCHANGE, 'topic', { durable: true });

      conn.on('error', (err) => {
        console.error('[RabbitMQ] connection error:', err.message);
        channel = null;
      });
      conn.on('close', () => {
        console.warn('[RabbitMQ] connection closed — reconnecting...');
        channel = null;
        setTimeout(() => connectRabbitMQ(), 5000);
      });

      console.log('[RabbitMQ] connected to exchange:', EXCHANGE);
      return;
    } catch (err) {
      console.warn(`[RabbitMQ] attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

/**
 * Publish an event to the topic exchange.
 * @param {string} routingKey  e.g. "tenant.provisioned"
 * @param {object} payload
 */
function publishEvent(routingKey, payload) {
  if (!channel) {
    console.error('[RabbitMQ] channel not ready — event dropped:', routingKey);
    return;
  }
  const content = Buffer.from(JSON.stringify(payload));
  channel.publish(EXCHANGE, routingKey, content, {
    persistent: true,
    contentType: 'application/json',
    timestamp: Date.now(),
  });
  console.log(`[RabbitMQ] published → ${routingKey}`);
}

module.exports = { connectRabbitMQ, publishEvent };
