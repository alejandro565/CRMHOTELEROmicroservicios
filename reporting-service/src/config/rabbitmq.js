const amqp = require('amqplib');
let channel = null;
const EXCHANGE = process.env.RABBITMQ_EXCHANGE || 'hotel_events';

async function connectRabbitMQ(retries = 5, delay = 4000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const conn = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
      channel = await conn.createChannel();
      await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
      conn.on('error', (e) => { console.error('[RabbitMQ] error:', e.message); channel = null; });
      conn.on('close', () => { channel = null; setTimeout(() => connectRabbitMQ(), 5000); });
      console.log('[RabbitMQ] reporting-service connected');
      return;
    } catch (err) {
      console.warn(`[RabbitMQ] attempt ${attempt}/${retries}: ${err.message}`);
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}
function getChannel() { return channel; }
module.exports = { connectRabbitMQ, getChannel };
