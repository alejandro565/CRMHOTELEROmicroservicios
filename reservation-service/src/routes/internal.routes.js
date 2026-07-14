const router = require('express').Router();
const { Op, fn, col, literal } = require('sequelize');
const { internalAuth } = require('../middlewares/authenticate');
const { Reservation, ReservationRoom, ReservationGuest, RESERVATION_STATUS } = require('../models');

router.use(internalAuth);

/**
 * GET /internal/reservations/:id/status
 * Used by billing-service to verify reservation exists before creating a folio.
 */
router.get('/reservations/:id/status', async (req, res, next) => {
  try {
    const { tenant_id } = req.query;
    const reservation = await Reservation.findOne({
      where: { id: req.params.id, tenant_id },
      attributes: ['id', 'status', 'total_price', 'main_guest_id', 'tenant_id'],
    });
    if (!reservation) return res.status(404).json({ success: false, error_code: 'RESERVATION_NOT_FOUND' });
    res.json({ success: true, data: reservation });
  } catch (err) { next(err); }
});

/**
 * GET /internal/reservations/active-for-guest/:guestId
 * Used by guest-service GUEST_MERGED to find reservations that need guest_id updated.
 */
router.get('/reservations/active-for-guest/:guestId', async (req, res, next) => {
  try {
    const { tenant_id } = req.query;
    const reservations = await Reservation.findAll({
      where: {
        tenant_id,
        main_guest_id: req.params.guestId,
        status: { [Op.in]: [RESERVATION_STATUS.CONFIRMED, RESERVATION_STATUS.PRE_CHECKIN, RESERVATION_STATUS.IN_HOUSE] },
      },
      attributes: ['id', 'status'],
    });
    res.json({ success: true, data: reservations });
  } catch (err) { next(err); }
});

/**
 * GET /internal/stats
 * Called by reporting-service to get occupancy stats and most-used room.
 * Query: ?tenant_id=xxx&from=yyyy-MM-dd&to=yyyy-MM-dd
 */
router.get('/stats', async (req, res, next) => {
  try {
    const { tenant_id, from, to } = req.query;
    if (!tenant_id) return res.status(400).json({ success: false, error_code: 'MISSING_TENANT' });

    const where = { tenant_id };
    if (from || to) {
      where[Op.or] = [
        { check_in_date: { ...(from ? { [Op.gte]: from } : {}), ...(to ? { [Op.lte]: to } : {}) } },
      ];
    }

    // Most used room_type and physical room_number in the date range
    const rooms = await ReservationRoom.findAll({
      where: {
        tenant_id,
        ...(from || to ? {
          check_in_date: {
            ...(from ? { [Op.gte]: from } : {}),
            ...(to   ? { [Op.lte]: to }   : {}),
          }
        } : {}),
        room_number: { [Op.ne]: null },
      },
      attributes: ['room_number', 'room_type_name'],
      raw: true,
    });

    // Count occurrences per room_number
    const roomCount = {};
    for (const r of rooms) {
      const key = r.room_number;
      if (!roomCount[key]) roomCount[key] = { room_number: r.room_number, room_type_name: r.room_type_name, count: 0 };
      roomCount[key].count++;
    }
    const sortedRooms = Object.values(roomCount).sort((a, b) => b.count - a.count);
    const mostUsedRoom = sortedRooms[0] || null;

    // Count reservations for the period
    const reservationCount = await Reservation.count({
      where: {
        tenant_id,
        status: { [Op.in]: [RESERVATION_STATUS.CHECKED_OUT, RESERVATION_STATUS.IN_HOUSE] },
        ...(from ? { created_at: { [Op.gte]: new Date(from) } } : {}),
      }
    });

    // Current in-house count for occupancy
    const currentOccupied = await Reservation.count({
      where: { tenant_id, status: RESERVATION_STATUS.IN_HOUSE },
    });

    res.json({
      most_used_room:    mostUsedRoom,
      all_rooms_ranked:  sortedRooms.slice(0, 5),
      reservation_count: reservationCount,
      current_occupied:  currentOccupied,
    });
  } catch (err) { next(err); }
});

/**
 * GET /internal/guests-report
 * Returns guest list for a date range — for printing/exporting guest report.
 * Query: ?tenant_id=xxx&from=yyyy-MM-dd&to=yyyy-MM-dd
 */
router.get('/guests-report', async (req, res, next) => {
  try {
    const { tenant_id, from, to } = req.query;
    if (!tenant_id) return res.status(400).json({ success: false, error_code: 'MISSING_TENANT' });

    // Find all reservations in period
    const reservations = await Reservation.findAll({
      where: {
        tenant_id,
        status: { [Op.in]: [RESERVATION_STATUS.IN_HOUSE, RESERVATION_STATUS.CHECKED_OUT, RESERVATION_STATUS.PRE_CHECKIN, RESERVATION_STATUS.CONFIRMED] },
        ...(from || to ? {
          created_at: {
            ...(from ? { [Op.gte]: new Date(from + 'T00:00:00.000Z') } : {}),
            ...(to   ? { [Op.lte]: new Date(to   + 'T23:59:59.999Z') } : {}),
          }
        } : {}),
      },
      include: [
        {
          model: ReservationRoom,
          as: 'rooms',
          attributes: ['room_number', 'room_type_name', 'check_in_date', 'check_out_date', 'rate_per_night'],
          include: [
            {
              model: ReservationGuest,
              as: 'guests',
              attributes: ['guest_name', 'is_primary', 'origin_country', 'origin_city', 'id_verified'],
            }
          ],
        },
        // Also include pool guests NOT yet assigned to a specific room
        {
          model: ReservationGuest,
          as: 'guest_list',
          attributes: ['guest_name', 'is_primary', 'origin_country', 'origin_city', 'id_verified', 'res_room_id'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    // Build a lookup: reservation → first room info (for pool guests)
    const rows = [];
    const seen = new Set(); // avoid duplicates if guest appears in both associations

    for (const resv of reservations) {
      const firstRoom = resv.rooms?.[0] || null;

      // 1) Room-assigned guests (res_room_id is set)
      for (const room of (resv.rooms || [])) {
        for (const guest of (room.guests || [])) {
          const key = `${resv.id}-${guest.guest_name}-${room.room_number}`;
          if (seen.has(key)) continue;
          seen.add(key);
          rows.push({
            reservation_id: resv.id.slice(0, 8),
            status:         resv.status,
            guest_name:     guest.guest_name || '—',
            is_primary:     guest.is_primary,
            origin_country: guest.origin_country || '—',
            origin_city:    guest.origin_city    || '—',
            id_verified:    guest.id_verified,
            room_number:    room.room_number     || '—',
            room_type:      room.room_type_name  || '—',
            check_in_date:  room.check_in_date,
            check_out_date: room.check_out_date,
            rate_per_night: parseFloat(room.rate_per_night || 0).toFixed(2),
          });
        }
      }

      // 2) Pool guests without a room assignment
      for (const guest of (resv.guest_list || [])) {
        if (guest.res_room_id) continue; // already covered above
        const key = `${resv.id}-${guest.guest_name}-pool`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({
          reservation_id: resv.id.slice(0, 8),
          status:         resv.status,
          guest_name:     guest.guest_name || '—',
          is_primary:     guest.is_primary,
          origin_country: guest.origin_country || '—',
          origin_city:    guest.origin_city    || '—',
          id_verified:    guest.id_verified,
          room_number:    firstRoom?.room_number  || '—',
          room_type:      firstRoom?.room_type_name || '—',
          check_in_date:  firstRoom?.check_in_date  || null,
          check_out_date: firstRoom?.check_out_date || null,
          rate_per_night: parseFloat(firstRoom?.rate_per_night || 0).toFixed(2),
        });
      }
    }

    res.json({ total: rows.length, rows });
  } catch (err) { next(err); }
});

module.exports = router;
