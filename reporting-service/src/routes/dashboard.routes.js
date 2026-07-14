const router = require('express').Router();
const { authenticate, requirePermission } = require('../middlewares/errorHandler');
const svc = require('../services/reporting.service');

router.use(authenticate);

/**
 * GET /dashboard/manager
 * Main KPI dashboard for hotel management.
 * Query: ?from=2024-01-01&to=2024-01-31
 */
router.get('/manager', requirePermission('REPORTS_FINANCIAL'), async (req, res, next) => {
  try {
    const data = await svc.generateManagerDashboard(req.user.tid, {
      from: req.query.from,
      to:   req.query.to,
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

/**
 * GET /dashboard/live-summary
 * Real-time KPIs: fetches live data from billing-service and reservation-service.
 * Bypasses projection tables — always returns current numbers.
 * Query: ?from=2024-01-01&to=2024-01-31
 */
router.get('/live-summary', requirePermission('REPORTS_FINANCIAL'), async (req, res, next) => {
  try {
    const data = await svc.getLiveSummary(req.user.tid, {
      from: req.query.from,
      to:   req.query.to,
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

/**
 * GET /dashboard/most-used-room
 * Returns the most-occupied physical rooms in the date range.
 * Query: ?from=2024-01-01&to=2024-01-31
 */
router.get('/most-used-room', requirePermission('REPORTS_FINANCIAL'), async (req, res, next) => {
  try {
    const data = await svc.getMostUsedRoom(req.user.tid, {
      from: req.query.from,
      to:   req.query.to,
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

/**
 * GET /dashboard/occupancy
 * Occupancy chart data for the given period.
 */
router.get('/occupancy', requirePermission('REPORTS_FINANCIAL'), async (req, res, next) => {
  try {
    const data = await svc.getOccupancyReport(req.user.tid, {
      from: req.query.from,
      to:   req.query.to,
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

/**
 * GET /dashboard/shifts
 * Cashier shift history for management review.
 */
router.get('/shifts', requirePermission('REPORTS_FINANCIAL'), async (req, res, next) => {
  try {
    const data = await svc.getShiftReports(req.user.tid, {
      from: req.query.from,
      to:   req.query.to,
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

module.exports = router;
