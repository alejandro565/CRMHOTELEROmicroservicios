const axios = require('axios');

const client = axios.create({
  baseURL: process.env.BILLING_SERVICE_URL || 'http://billing-service:3007',
  timeout: 6000,
  headers: { 'x-internal-token': process.env.INTERNAL_TOKEN },
});

/**
 * Check if a reservation has an outstanding balance.
 * Called during processCheckOut to block if balance > 0.
 * Returns { balance: number, has_pending: boolean }
 */
async function getBalance(reservationId, tenantId) {
  try {
    const { data } = await client.get(`/internal/folios/${reservationId}/balance`, {
      params: { tenant_id: tenantId },
    });
    return data;
  } catch (err) {
    // If billing-service is unreachable, default to allowing checkout (fail-open)
    // but log the error loudly
    console.error('[BillingClient] getBalance failed:', err.message);
    return { balance: 0, has_pending: false };
  }
}

/**
 * Fire-and-forget: notify billing that charges need to be added/updated.
 * Used on extendStay and editReservation.
 */
function updateCharges({ reservation_id, tenant_id, new_total, reason, items }) {
  client
    .patch('/internal/billing/update-charges', { reservation_id, tenant_id, new_total, reason, items })
    .catch((err) => console.error('[BillingClient] updateCharges failed:', err.message));
}

/**
 * Add a DAMAGE charge to the folio when a lent item is marked as LOST.
 * This is fire-and-forget but logs errors loudly.
 */
function addLostItemCharge({ reservation_id, tenant_id, item_name, amount }) {
  client
    .post('/internal/charges', {
      reservation_id,
      tenant_id,
      category: 'DAMAGE',
      description: `Objeto perdido: ${item_name}`,
      amount,
    })
    .catch((err) => console.error('[BillingClient] addLostItemCharge failed:', err.message));
}

module.exports = { getBalance, updateCharges, addLostItemCharge };
