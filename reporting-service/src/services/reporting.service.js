const { Op } = require('sequelize');
const axios  = require('axios');
const { sequelize } = require('../config/database');
const { DailyOccupancyStats, RevenueStats, ShiftReport } = require('../models/index');

// ─── Internal HTTP client helper ─────────────────────────────────────────────

function internalHeaders() {
  return { 'x-internal-token': process.env.INTERNAL_TOKEN || 'super_secret_internal_token' };
}

const BILLING_URL     = process.env.BILLING_SERVICE_URL     || 'http://billing-service:3007';
const RESERVATION_URL = process.env.RESERVATION_SERVICE_URL || 'http://reservation-service:3005';

// ─── Dashboard KPIs ───────────────────────────────────────────────────────────

/**
 * Manager dashboard: occupancy + revenue for a date range.
 * Aggregates the projection tables — no cross-service calls needed.
 */
async function generateManagerDashboard(tenant_id, { from, to } = {}) {
  const today = new Date().toISOString().split('T')[0];
  const dateFrom = from || _daysAgo(30);
  const dateTo   = to   || today;

  const [occupancy, revenue] = await Promise.all([
    DailyOccupancyStats.findAll({
      where: { tenant_id, date: { [Op.between]: [dateFrom, dateTo] } },
      order: [['date', 'ASC']],
    }),
    RevenueStats.findAll({
      where: { tenant_id, date: { [Op.between]: [dateFrom, dateTo] } },
      order: [['date', 'ASC']],
    }),
  ]);

  // Aggregate totals
  const totalRevenue    = revenue.reduce((s, r) => s + Number(r.total_revenue), 0);
  const avgOccupancy    = occupancy.length
    ? occupancy.reduce((s, o) => s + Number(o.occupancy_percentage), 0) / occupancy.length
    : 0;
  const avgADR   = revenue.filter((r) => r.category === 'ROOM').reduce((s, r, _i, a) => s + Number(r.adr) / a.length, 0);
  const avgRevPAR = revenue.filter((r) => r.category === 'ROOM').reduce((s, r, _i, a) => s + Number(r.revpar) / a.length, 0);

  return {
    period:      { from: dateFrom, to: dateTo },
    summary: {
      total_revenue:       parseFloat(totalRevenue.toFixed(2)),
      avg_occupancy_pct:   parseFloat(avgOccupancy.toFixed(2)),
      avg_adr:             parseFloat(avgADR.toFixed(2)),
      avg_revpar:          parseFloat(avgRevPAR.toFixed(2)),
    },
    daily_occupancy: occupancy,
    daily_revenue:   revenue,
  };
}

// ─── Live summary (real-time cross-service) ────────────────────────────────────

/**
 * Fetches live KPI data directly from billing-service and reservation-service.
 * This bypasses the projection tables and always returns up-to-date numbers.
 */
async function getLiveSummary(tenant_id, { from, to } = {}) {
  const dateFrom = from || _daysAgo(30);
  const dateTo   = to   || new Date().toISOString().split('T')[0];

  const qs = `tenant_id=${tenant_id}&from=${dateFrom}&to=${dateTo}`;

  const [billingRes, reservationRes] = await Promise.allSettled([
    axios.get(`${BILLING_URL}/internal/summary?${qs}`,     { headers: internalHeaders() }),
    axios.get(`${RESERVATION_URL}/internal/stats?${qs}`,   { headers: internalHeaders() }),
  ]);

  const billing     = billingRes.status     === 'fulfilled' ? billingRes.value.data     : {};
  const reservation = reservationRes.status === 'fulfilled' ? reservationRes.value.data : {};

  return {
    period: { from: dateFrom, to: dateTo },
    summary: {
      total_revenue:     billing.total_revenue     ?? 0,
      avg_adr:           billing.avg_adr           ?? 0,
      current_occupied:  reservation.current_occupied  ?? 0,
      reservation_count: reservation.reservation_count ?? 0,
    },
    most_used_room:   reservation.most_used_room   ?? null,
    all_rooms_ranked: reservation.all_rooms_ranked ?? [],
    daily_revenue:    billing.daily                ?? [],
  };
}

/**
 * Fetches the most-used room from reservation-service internal API.
 */
async function getMostUsedRoom(tenant_id, { from, to } = {}) {
  const dateFrom = from || _daysAgo(30);
  const dateTo   = to   || new Date().toISOString().split('T')[0];
  const qs = `tenant_id=${tenant_id}&from=${dateFrom}&to=${dateTo}`;

  try {
    const res = await axios.get(`${RESERVATION_URL}/internal/stats?${qs}`, { headers: internalHeaders() });
    return {
      most_used_room:   res.data.most_used_room   || null,
      all_rooms_ranked: res.data.all_rooms_ranked || [],
    };
  } catch (err) {
    console.error('[ReportingService] getMostUsedRoom error:', err.message);
    return { most_used_room: null, all_rooms_ranked: [] };
  }
}

/**
 * Fetches the guest report for a date range from reservation-service internal API.
 */
async function getGuestReport(tenant_id, { from, to } = {}) {
  const qs = `tenant_id=${tenant_id}${from ? '&from=' + from : ''}${to ? '&to=' + to : ''}`;
  try {
    const res = await axios.get(`${RESERVATION_URL}/internal/guests-report?${qs}`, { headers: internalHeaders() });
    return res.data;
  } catch (err) {
    console.error('[ReportingService] getGuestReport error:', err.message);
    return { total: 0, rows: [] };
  }
}

// ─── Sync (called by cron + consumer) ────────────────────────────────────────

/**
 * Upsert occupancy stats for a given date.
 * Called when CHECKIN/CHECKOUT events arrive or by the nightly cron.
 */
async function syncOccupancy(tenant_id, date, { total_rooms, occupied_rooms }) {
  const occupancy_percentage = total_rooms > 0
    ? parseFloat(((occupied_rooms / total_rooms) * 100).toFixed(2))
    : 0;

  await DailyOccupancyStats.upsert({
    tenant_id, date, total_rooms, occupied_rooms, occupancy_percentage,
  });
}

/**
 * Upsert revenue stats for a given date and category.
 * Called when RESERVATION_CREATED or BILLING events arrive.
 */
async function syncRevenue(tenant_id, date, { total_revenue, category = 'ROOM', total_rooms = 0, occupied_rooms = 0 }) {
  const adr    = occupied_rooms > 0 ? parseFloat((total_revenue / occupied_rooms).toFixed(2)) : 0;
  const revpar = total_rooms    > 0 ? parseFloat((total_revenue / total_rooms).toFixed(2))    : 0;

  await RevenueStats.upsert({ tenant_id, date, total_revenue, category, adr, revpar });
}

/**
 * Record a shift closure for historical cashier analysis.
 */
async function recordShiftReport(payload) {
  const { tenant_id, shift_id, user_id, expected_cash, actual_cash, difference, expected_totals } = payload;

  await ShiftReport.upsert({
    tenant_id, shift_id, user_id,
    expected_cash: parseFloat(expected_cash || 0),
    actual_cash:   parseFloat(actual_cash   || 0),
    difference:    parseFloat(difference    || 0),
    totals_snapshot: expected_totals || {},
    closed_at:     new Date(),
  });
}

// ─── Reports ──────────────────────────────────────────────────────────────────

async function getSalesReport(tenant_id, { from, to, category } = {}) {
  const where = { tenant_id };
  if (from || to) where.date = {};
  if (from) where.date[Op.gte] = from;
  if (to)   where.date[Op.lte] = to;
  if (category) where.category = category;

  const rows = await RevenueStats.findAll({ where, order: [['date', 'ASC']] });

  const grand_total = rows.reduce((s, r) => s + Number(r.total_revenue), 0);
  return {
    period: { from, to },
    grand_total: parseFloat(grand_total.toFixed(2)),
    rows,
  };
}

async function getOccupancyReport(tenant_id, { from, to } = {}) {
  const where = { tenant_id };
  if (from || to) where.date = {};
  if (from) where.date[Op.gte] = from;
  if (to)   where.date[Op.lte] = to;

  return DailyOccupancyStats.findAll({ where, order: [['date', 'ASC']] });
}

async function getShiftReports(tenant_id, { from, to } = {}) {
  const where = { tenant_id };
  if (from || to) where.closed_at = {};
  if (from) where.closed_at[Op.gte] = new Date(from);
  if (to)   where.closed_at[Op.lte] = new Date(to);

  return ShiftReport.findAll({ where, order: [['closed_at', 'DESC']] });
}

// ─── Libro de Ventas (Bolivian tax compliance) ────────────────────────────────

/**
 * Generates the structured data for the monthly Libro de Ventas (VAT book).
 * Returns rows ready to be exported to Excel or PDF.
 */
async function getLibroDeVentas(tenant_id, { year, month }) {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to   = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

  const revenue = await RevenueStats.findAll({
    where: { tenant_id, date: { [Op.between]: [from, to] }, category: 'ROOM' },
    order: [['date', 'ASC']],
  });

  return {
    period: { year, month, from, to },
    total_revenue: parseFloat(revenue.reduce((s, r) => s + Number(r.total_revenue), 0).toFixed(2)),
    rows: revenue.map((r) => ({
      date:          r.date,
      total_revenue: r.total_revenue,
      adr:           r.adr,
    })),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

module.exports = {
  generateManagerDashboard,
  getLiveSummary,
  getMostUsedRoom,
  getGuestReport,
  syncOccupancy,
  syncRevenue,
  recordShiftReport,
  getSalesReport,
  getOccupancyReport,
  getShiftReports,
  getLibroDeVentas,
};

