const amqp = require('amqplib');

let channel = null;
const EXCHANGE = process.env.RABBITMQ_EXCHANGE || 'hotel_events';

/**
 * Establece la conexión con RabbitMQ con lógica de reintentos
 */
async function connectRabbitMQ(retries = 5, delay = 4000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const url = process.env.RABBITMQ_URL || 'amqp://localhost';
      const conn = await amqp.connect(url);
      
      channel = await conn.createChannel();
      
      // Aseguramos que el exchange exista (tipo 'topic' es muy flexible para microservicios)
      await channel.assertExchange(EXCHANGE, 'topic', { durable: true });

      // Manejo de errores de conexión
      conn.on('error', (err) => { 
        console.error('[RabbitMQ] error en la conexión:', err.message); 
        channel = null; 
      });

      // Manejo de cierre de conexión (intenta reconectar)
      conn.on('close', () => {
        console.warn('[RabbitMQ] conexión cerrada — reintentando en 5s...');
        channel = null;
        setTimeout(() => connectRabbitMQ(), 5000);
      });

      console.log('[RabbitMQ] hotels-service connected');
      return;
    } catch (err) {
      console.warn(`[RabbitMQ] intento ${attempt}/${retries} fallido: ${err.message}`);
      if (attempt === retries) {
        console.error('[RabbitMQ] No se pudo conectar tras varios intentos.');
        throw err;
      }
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

function getChannel() { 
  return channel; 
}

/**
 * Helper para publicar eventos de forma sencilla
 */
function publishEvent(routingKey, payload) {
  if (!channel) { 
    console.error('[RabbitMQ] canal no disponible — evento descartado:', routingKey); 
    return; 
  }
  
  channel.publish(
    EXCHANGE, 
    routingKey,
    Buffer.from(JSON.stringify(payload)),
    { 
      persistent: true, 
      contentType: 'application/json', 
      timestamp: Date.now() 
    }
  );
  console.log(`[RabbitMQ] evento publicado → ${routingKey}`);
}

module.exports = { connectRabbitMQ, getChannel, publishEvent };