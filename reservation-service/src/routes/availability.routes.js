const router = require('express').Router();
const { authenticate, requirePermission } = require('../middlewares/authenticate');
const { checkAvailability } = require('../services/availability.service');
const AppError = require('../middlewares/AppError');

router.use(authenticate);

/**
 * GET /availability/all
 * Query: ?check_in_date=2024-01-10&check_out_date=2024-01-14
 * Returns availability for all room types in a single request.
 */
router.get('/all', requirePermission('RESERVATIONS_VIEW'), async (req, res, next) => {
  try {
    const { check_in_date, check_out_date } = req.query;
    if (!check_in_date || !check_out_date) {
      return next(new AppError('check_in_date y check_out_date son requeridos', 400, 'MISSING_PARAMS'));
    }
    const { checkAllAvailability } = require('../services/availability.service');
    const data = await checkAllAvailability(req.user.tid, check_in_date, check_out_date);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

/**
 * GET /availability
 * Query: ?room_type_id=uuid&check_in_date=2024-01-10&check_out_date=2024-01-14
 */
router.get('/', requirePermission('RESERVATIONS_VIEW'), async (req, res, next) => {
  try {
    const { room_type_id, check_in_date, check_out_date } = req.query;
    if (!room_type_id || !check_in_date || !check_out_date) {
      return next(new AppError('room_type_id, check_in_date y check_out_date son requeridos', 400, 'MISSING_PARAMS'));
    }
    const data = await checkAvailability(req.user.tid, room_type_id, check_in_date, check_out_date);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

/**
 * GET /availability/physical-rooms
 * Query: ?room_type_id=uuid&check_in_date=2024-01-10&check_out_date=2024-01-14
 * Returns list of physical rooms that are free from reservations during this period (including 2 days preparation).
 */
router.get('/physical-rooms', requirePermission('RESERVATIONS_VIEW'), async (req, res, next) => {
  try {
    const { room_type_id, check_in_date, check_out_date, exclude_res_room_id } = req.query;
    if (!room_type_id || !check_in_date || !check_out_date) {
      return next(new AppError('room_type_id, check_in_date y check_out_date son requeridos', 400, 'MISSING_PARAMS'));
    }
    const { getFreePhysicalRooms } = require('../services/availability.service');
    const data = await getFreePhysicalRooms(req.user.tid, room_type_id, check_in_date, check_out_date, { exclude_res_room_id });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

module.exports = router;
