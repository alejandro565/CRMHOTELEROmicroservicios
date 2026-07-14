const cron = require('node-cron');
const { Op } = require('sequelize');
const { ReservationRoom, Reservation, RESERVATION_STATUS } = require('../models');
const { publishRoomAlertNeeded } = require('../events/publisher');

/**
 * ROOM_ALERT_NEEDED — runs daily at 08:00.
 * Finds all reservation rooms arriving tomorrow that have a physical room assigned,
 * and emits an event so hotels-service can verify they are CLEAN.
 */
async function runRoomAlertJob() {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const rooms = await ReservationRoom.findAll({
      where: {
        check_in_date: tomorrowStr,
        room_id:       { [Op.ne]: null }, // only assigned rooms
      },
      include: [{
        model: Reservation, as: 'reservation',
        where: { status: { [Op.in]: [RESERVATION_STATUS.CONFIRMED, RESERVATION_STATUS.PRE_CHECKIN] } },
        attributes: ['id', 'tenant_id'],
      }],
    });

    // Group by tenant
    const byTenant = {};
    for (const room of rooms) {
      const tid = room.reservation.tenant_id;
      if (!byTenant[tid]) byTenant[tid] = [];
      byTenant[tid].push({
        room_id:        room.room_id,
        room_number:    room.room_number,
        reservation_id: room.reservation_id,
      });
    }

    for (const [tenant_id, arrivals] of Object.entries(byTenant)) {
      publishRoomAlertNeeded({ tenant_id, rooms_arriving_tomorrow: arrivals });
      console.log(`[RoomAlertJob] ${arrivals.length} room(s) alerted for tenant ${tenant_id}`);
    }
  } catch (err) {
    console.error('[RoomAlertJob] failed:', err.message);
  }
}

function startJobs() {
  // Every day at 08:00 server time
  cron.schedule('0 8 * * *', () => {
    console.log('[RoomAlertJob] running...');
    runRoomAlertJob();
  });
  console.log('[Jobs] scheduled: room_alert @ 08:00 daily');
}

module.exports = { startJobs, runRoomAlertJob };
