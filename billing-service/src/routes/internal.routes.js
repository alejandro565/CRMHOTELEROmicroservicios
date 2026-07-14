const router = require('express').Router();
const { Op } = require('sequelize');
const { internalAuth } = require('../middlewares/authenticate');
const { Folio, Charge, Payment } = require('../models');

router.use(internalAuth);

/**
 * GET /internal/folios/:reservationId/balance
 * Called by reservation-service before allowing check-out.
 * Returns the combined balance of all open folios for the reservation.
 */
router.get('/folios/:reservationId/balance', async (req, res, next) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ success: false, error_code: 'MISSING_TENANT' });

    const folios = await Folio.findAll({ where: { reservation_id: req.params.reservationId, tenant_id } });
    if (!folios.length) return res.json({ balance: 0, has_pending: false });

    let total = 0;
    for (const folio of folios) total += Number(folio.balance);

    res.json({
      balance:     parseFloat(total.toFixed(2)),
      has_pending: total > 0,
      folio_count: folios.length,
    });
  } catch (err) { next(err); }
});

/**
 * PATCH /internal/billing/update-charges
 * Called by reservation-service when a stay is extended or edited.
 * Fire-and-forget from their side; we process synchronously here.
 */
router.patch('/billing/update-charges', async (req, res, next) => {
  try {
    const { reservation_id, tenant_id, new_total, reason, items } = req.body;
    if (!reservation_id || !tenant_id) {
      return res.status(400).json({ success: false, error_code: 'MISSING_FIELDS' });
    }

    // Just acknowledge — the reservation.stay_extended RabbitMQ event handles the actual charge
    // This endpoint exists for direct HTTP fallback
    console.log(`[Internal] update-charges received for reservation ${reservation_id}: Bs ${new_total} — ${reason}`);
    res.json({ success: true, acknowledged: true });
  } catch (err) { next(err); }
});

/**
 * GET /internal/summary
 * Called by reporting-service to get real revenue/payment KPIs for a date range.
 * Query: ?tenant_id=xxx&from=yyyy-MM-dd&to=yyyy-MM-dd
 */
router.get('/summary', async (req, res, next) => {
  try {
    const { tenant_id, from, to } = req.query;
    if (!tenant_id) return res.status(400).json({ success: false, error_code: 'MISSING_TENANT' });

    const dateFilter = {};
    if (from) dateFilter[Op.gte] = new Date(from + 'T00:00:00.000Z');
    if (to)   dateFilter[Op.lte] = new Date(to   + 'T23:59:59.999Z');

    // Total payments (real cash collected), excluding voided
    const payments = await Payment.findAll({
      where: {
        tenant_id,
        is_voided: false,
        ...(Object.keys(dateFilter).length ? { created_at: dateFilter } : {}),
      },
      attributes: ['amount_base', 'created_at'],
    });

    // Total charges grouped — for ADR calculation (room charges only)
    const charges = await Charge.findAll({
      where: {
        tenant_id,
        is_voided: false,
        category: 'ACCOMMODATION',
        ...(Object.keys(dateFilter).length ? { created_at: dateFilter } : {}),
      },
      attributes: ['amount'],
    });

    const totalRevenue  = payments.reduce((s, p) => s + Number(p.amount_base), 0);
    const totalRoomCharges = charges.reduce((s, c) => s + Number(c.amount), 0);
    // ADR: average daily rate = total room charges / number of room charges
    const avgAdr = charges.length > 0 ? totalRoomCharges / charges.length : 0;

    // Daily revenue breakdown for charts
    const dailyMap = {};
    for (const p of payments) {
      const day = new Date(p.created_at).toISOString().split('T')[0];
      dailyMap[day] = (dailyMap[day] || 0) + Number(p.amount_base);
    }

    res.json({
      total_revenue: parseFloat(totalRevenue.toFixed(2)),
      avg_adr:       parseFloat(avgAdr.toFixed(2)),
      daily:         Object.entries(dailyMap).map(([date, total]) => ({ date, total_revenue: parseFloat(total.toFixed(2)) })).sort((a,b) => a.date.localeCompare(b.date)),
    });
  } catch (err) { next(err); }
});

/**
 * POST /internal/charges
 * Called by reservation-service to add a charge directly to a reservation's folio.
 * Used when a lent item is marked as LOST — auto-charges the guest the replacement cost.
 */
router.post('/charges', async (req, res, next) => {
  try {
    const { reservation_id, tenant_id, category, description, amount } = req.body;
    if (!reservation_id || !tenant_id || !category || !amount) {
      return res.status(400).json({ success: false, error_code: 'MISSING_FIELDS' });
    }

    // Find the MASTER folio for this reservation
    const folio = await Folio.findOne({
      where: { reservation_id, tenant_id, type: 'MASTER' },
    }) || await Folio.findOne({ where: { reservation_id, tenant_id } });

    if (!folio) {
      return res.status(404).json({ success: false, error_code: 'FOLIO_NOT_FOUND', message: 'No se encontró un folio para esta reserva' });
    }

    if (folio.status !== 'OPEN') {
      return res.status(409).json({ success: false, error_code: 'FOLIO_CLOSED', message: 'El folio ya está cerrado' });
    }

    const { addCharge } = require('../services/charge.service');
    const result = await addCharge({
      folio_id: folio.id,
      tenant_id,
      category,
      amount: parseFloat(amount),
      description,
      source_ref: 'LOST_ITEM',
    });

    res.status(201).json({ success: true, data: result.charge });
  } catch (err) { next(err); }
});

module.exports = router;
