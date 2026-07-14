const { getChannel }    = require('../config/rabbitmq');
const { syncOccupancy, syncRevenue, recordShiftReport } = require('../services/reporting.service');

const EXCHANGE = process.env.RABBITMQ_EXCHANGE || 'hotel_events';
const QUEUE    = 'reporting_service_events';
const BINDINGS = [
  'reservation.checkin',
  'reservation.checkout',
  'reservation.created',
  'billing.shift_closed',
  'billing.folio_cleared',
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * On checkin: increment occupied_rooms for the check_in_date.
 * We use a simplified upsert — the nightly cron will do a full reconciliation.
 */
async function handleCheckin({ tenant_id, occurred_at }) {
  const date = (occurred_at || new Date().toISOString()).split('T')[0];
  // Increment occupied rooms by 1 for that date
  const [stats] = await require('../models/index').DailyOccupancyStats.findOrCreate({
    where: { tenant_id, date },
    defaults: { tenant_id, date, total_rooms: 0, occupied_rooms: 0, occupancy_percentage: 0 },
  });
  const newOccupied = stats.occupied_rooms + 1;
  const pct = stats.total_rooms > 0
    ? parseFloat(((newOccupied / stats.total_rooms) * 100).toFixed(2))
    : 0;
  await stats.update({ occupied_rooms: newOccupied, occupancy_percentage: pct });
}

/**
 * On checkout: decrement occupied_rooms for that date.
 */
async function handleCheckout({ tenant_id, occurred_at }) {
  const date = (occurred_at || new Date().toISOString()).split('T')[0];
  const stats = await require('../models/index').DailyOccupancyStats.findOne({ where: { tenant_id, date } });
  if (!stats) return;
  const newOccupied = Math.max(0, stats.occupied_rooms - 1);
  const pct = stats.total_rooms > 0
    ? parseFloat(((newOccupied / stats.total_rooms) * 100).toFixed(2))
    : 0;
  await stats.update({ occupied_rooms: newOccupied, occupancy_percentage: pct });
}

/**
 * On reservation.created: seed a revenue row with the booking amount.
 */
async function handleReservationCreated({ tenant_id, total_price, rooms, occurred_at }) {
  const date = (occurred_at || new Date().toISOString()).split('T')[0];
  if (!total_price) return;
  await syncRevenue(tenant_id, date, {
    total_revenue: parseFloat(total_price),
    category:      'ROOM',
  });
}

/**
 * On billing.shift_closed: snapshot the shift totals for cashier reporting.
 */
async function handleShiftClosed(payload) {
  await recordShiftReport(payload);
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

async function dispatch(routingKey, payload) {
  switch (routingKey) {
    case 'reservation.checkin':  return handleCheckin(payload);
    case 'reservation.checkout': return handleCheckout(payload);
    case 'reservation.created':  return handleReservationCreated(payload);
    case 'billing.shift_closed': return handleShiftClosed(payload);
    case 'billing.folio_cleared': break; // future: mark reservation as payable
    default: console.warn(`[Consumer] unhandled key: ${routingKey}`);
  }
}

async function startConsumers() {
  const channel = getChannel();
  if (!channel) { console.error('[Consumer] channel not available'); return; }

  await channel.assertQueue(QUEUE, { durable: true });
  for (const key of BINDINGS) await channel.bindQueue(QUEUE, EXCHANGE, key);

  channel.prefetch(3);
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

  console.log(`[Consumer] reporting listening on queue: ${QUEUE}`);
}

module.exports = { startConsumers };
