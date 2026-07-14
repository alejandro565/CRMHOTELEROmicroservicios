const { getChannel }     = require('../config/rabbitmq');
const { createFolioSet } = require('../services/folio.service');
const { addCharge }      = require('../services/charge.service');
const { Folio, FOLIO_TYPE } = require('../models');

const EXCHANGE  = process.env.RABBITMQ_EXCHANGE || 'hotel_events';
const QUEUE     = 'billing_service_events';
const BINDINGS  = ['reservation.created', 'reservation.stay_extended', 'item.damage_reported'];

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * RESERVATION_CREATED — open the Master + Incidental folio pair.
 * Also adds the initial accommodation charges.
 */
async function handleReservationCreated({ tenant_id, reservation_id, total_price, rooms }) {
  const folioSet = await createFolioSet(tenant_id, reservation_id);
  if (!folioSet) return; // Already exists

  // Add initial accommodation charge to Master folio
  const roomsDescription = rooms?.length > 0
    ? rooms.map((r) => `${r.room_type_id} (${r.check_in_date} → ${r.check_out_date})`).join(', ')
    : 'Habitación';

  await addCharge({
    folio_id:    folioSet.master.id,
    tenant_id,
    category:    'ACCOMMODATION',
    amount:      parseFloat(total_price || 0),
    description: `Hospedaje: ${roomsDescription}`,
    source_ref:  `reservation:${reservation_id}`,
  });

  console.log(`[Consumer] folios created for reservation ${reservation_id}`);
}

/**
 * STAY_EXTENDED — add the extra nights charge to the accommodation folio.
 */
async function handleStayExtended({ tenant_id, reservation_id, extra_nights, extra_charge }) {
  const folio = await Folio.findOne({
    where: { tenant_id, reservation_id, type: FOLIO_TYPE.MASTER },
  });
  if (!folio) {
    console.warn(`[Consumer] STAY_EXTENDED — master folio not found for reservation ${reservation_id}`);
    return;
  }

  await addCharge({
    folio_id:    folio.id,
    tenant_id,
    category:    'ACCOMMODATION',
    amount:      parseFloat(extra_charge || 0),
    description: `Extensión de estadía: ${extra_nights} noche(s) adicional(es)`,
    source_ref:  `reservation:${reservation_id}`,
  });

  console.log(`[Consumer] stay extension charge added — reservation ${reservation_id}, extra: Bs ${extra_charge}`);
}

/**
 * ITEM_DAMAGE_REPORTED — hotels-service reports a lost/damaged item.
 * The charge goes to the incidental folio of the guest.
 */
async function handleItemDamageReported({ tenant_id, reservation_id, item_name, charge_amount, description }) {
  const folio = await Folio.findOne({
    where: { tenant_id, reservation_id, type: FOLIO_TYPE.INCIDENTAL },
  });
  if (!folio) {
    console.warn(`[Consumer] ITEM_DAMAGE — incidental folio not found for reservation ${reservation_id}`);
    return;
  }

  await addCharge({
    folio_id:    folio.id,
    tenant_id,
    category:    'DAMAGE',
    amount:      parseFloat(charge_amount || 0),
    description: description || `Daño/pérdida: ${item_name}`,
    source_ref:  `damage:${item_name}`,
  });

  console.log(`[Consumer] damage charge added — ${item_name}, amount: Bs ${charge_amount}`);
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

async function dispatch(routingKey, payload) {
  switch (routingKey) {
    case 'reservation.created':    return handleReservationCreated(payload);
    case 'reservation.stay_extended': return handleStayExtended(payload);
    case 'item.damage_reported':   return handleItemDamageReported(payload);
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
