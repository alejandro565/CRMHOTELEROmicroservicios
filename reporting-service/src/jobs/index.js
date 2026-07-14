const cron = require('node-cron');
const { DailyOccupancyStats, RevenueStats } = require('../models/index');
const { syncRevenue } = require('../services/reporting.service');

/**
 * syncDailyData — runs at 01:00 every night.
 * Ensures yesterday's projection rows are complete and consistent.
 * In a full implementation this would query other services' read replicas;
 * here it marks yesterday's row as reconciled if it exists.
 */
async function syncDailyData() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const date = yesterday.toISOString().split('T')[0];

  try {
    // Fetch all tenant IDs that have stats rows (we track what we know)
    const stats = await DailyOccupancyStats.findAll({
      where: { date },
      attributes: ['tenant_id', 'total_rooms', 'occupied_rooms'],
    });

    for (const s of stats) {
      // Recalculate occupancy percentage for consistency
      const pct = s.total_rooms > 0
        ? parseFloat(((s.occupied_rooms / s.total_rooms) * 100).toFixed(2))
        : 0;
      await s.update({ occupancy_percentage: pct });
    }

    console.log(`[SyncJob] reconciled ${stats.length} tenants for date ${date}`);
  } catch (err) {
    console.error('[SyncJob] syncDailyData failed:', err.message);
  }
}

function startJobs() {
  // Nightly reconciliation at 01:00
  cron.schedule('0 1 * * *', () => {
    console.log('[Jobs] running nightly sync...');
    syncDailyData();
  });

  console.log('[Jobs] scheduled: syncDailyData @ 01:00 daily');
}

module.exports = { startJobs, syncDailyData };
