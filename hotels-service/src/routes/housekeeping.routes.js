const router = require('express').Router();
const { authenticate, requirePermission } = require('../middlewares/authenticate');
const { Room, RoomType, ROOM_STATUS } = require('../models');

router.use(authenticate);

/**
 * GET /housekeeping/rack
 * Returns all rooms grouped by floor with their current status.
 * Optimised for the housekeeping board — no incidents detail needed.
 */
router.get('/rack', requirePermission('HOTELS_VIEW'), async (req, res, next) => {
  try {
    const rooms = await Room.findAll({
      where: { tenant_id: req.user.tid },
      include: [{ model: RoomType, as: 'room_type', attributes: ['name'] }],
      order: [['floor', 'ASC'], ['number', 'ASC']],
    });

    // Group by floor
    const byFloor = {};
    for (const r of rooms) {
      const f = r.floor;
      if (!byFloor[f]) byFloor[f] = [];
      byFloor[f].push({
        id:        r.id,
        number:    r.number,
        type:      r.room_type?.name,
        status:    r.status,
      });
    }

    const floors = Object.entries(byFloor)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([floor, rooms]) => ({ floor: Number(floor), rooms }));

    res.json({ success: true, data: floors });
  } catch (err) { next(err); }
});

/**
 * GET /housekeeping/pending
 * Returns only DIRTY rooms — the housekeeping queue.
 */
router.get('/pending', requirePermission('HOTELS_VIEW'), async (req, res, next) => {
  try {
    const rooms = await Room.findAll({
      where: { tenant_id: req.user.tid, status: ROOM_STATUS.DIRTY },
      include: [{ model: RoomType, as: 'room_type', attributes: ['name'] }],
      order: [['floor', 'ASC'], ['number', 'ASC']],
    });
    res.json({ success: true, data: rooms });
  } catch (err) { next(err); }
});

module.exports = router;
