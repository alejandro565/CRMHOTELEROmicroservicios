const router = require('express').Router();
const { internalAuth } = require('../middlewares/authenticate');
const { Room, ROOM_STATUS } = require('../models');

router.use(internalAuth);

/**
 * GET /internal/rooms/:roomId/validate-checkin
 * Called by reservation-service before confirming a check-in.
 * Returns whether the room is ready (status === CLEAN).
 *
 * Response contract:
 * {
 *   room_id, can_checkin, current_status, reason?
 * }
 */
router.get('/rooms/:roomId/validate-checkin', async (req, res, next) => {
  try {
    // tenant_id comes from query param for internal calls (no JWT here)
    const { tenant_id } = req.query;
    if (!tenant_id) {
      return res.status(400).json({ success: false, error_code: 'MISSING_TENANT', message: 'tenant_id query param required' });
    }

    const room = await Room.findOne({ where: { id: req.params.roomId, tenant_id } });

    if (!room) {
      return res.status(404).json({ success: false, error_code: 'ROOM_NOT_FOUND', message: 'Habitación no encontrada' });
    }

    const can_checkin = room.status === ROOM_STATUS.CLEAN;

    const reasonMap = {
      [ROOM_STATUS.DIRTY]:       'La habitación debe estar CLEAN para el check-in',
      [ROOM_STATUS.MAINTENANCE]: 'La habitación está en mantenimiento',
      [ROOM_STATUS.OCCUPIED]:    'La habitación ya está ocupada',
    };

    res.json({
      room_id:        room.id,
      room_number:    room.number,
      can_checkin,
      current_status: room.status,
      ...(can_checkin ? {} : { reason: reasonMap[room.status] }),
    });
  } catch (err) { next(err); }
});

/**
 * PATCH /internal/rooms/:roomId/status
 * Used by reservation-service to mark a room as OCCUPIED on check-in
 * or to trigger DIRTY on checkout (as an alternative to RabbitMQ).
 */
router.patch('/rooms/:roomId/status', async (req, res, next) => {
  try {
    const { tenant_id, status } = req.body;
    if (!tenant_id || !status) {
      return res.status(400).json({ success: false, error_code: 'MISSING_FIELDS' });
    }

    const allowed = [ROOM_STATUS.OCCUPIED, ROOM_STATUS.DIRTY, ROOM_STATUS.CLEAN];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, error_code: 'INVALID_STATUS' });
    }

    const room = await Room.findOne({ where: { id: req.params.roomId, tenant_id } });
    if (!room) return res.status(404).json({ success: false, error_code: 'ROOM_NOT_FOUND' });

    await room.update({ status });
    res.json({ success: true, room_id: room.id, new_status: status });
  } catch (err) { next(err); }
});

/**
 * GET /internal/rooms
 * Used by reservation-service to get all physical rooms for conflict detection.
 */
router.get('/rooms', async (req, res, next) => {
  try {
    const { tenant_id, room_type_id } = req.query;
    if (!tenant_id) {
      return res.status(400).json({ success: false, error_code: 'MISSING_TENANT' });
    }
    
    const whereClause = { tenant_id };
    if (room_type_id) whereClause.room_type_id = room_type_id;

    const rooms = await Room.findAll({ where: whereClause, attributes: ['id', 'number', 'status'] });
    res.json({ success: true, data: rooms });
  } catch (err) { next(err); }
});

/**
 * PATCH /internal/inventory/:itemId/adjust
 * Used by reservation-service to decrement stock on lend or increment on return.
 */
router.patch('/inventory/:itemId/adjust', async (req, res, next) => {
  try {
    const { tenant_id, qty, reason } = req.body;
    const svc = require('../services/lendable.service');
    const data = await svc.adjustInventory(req.params.itemId, tenant_id, qty, reason);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

/**
 * GET /internal/items/:itemId
 * Used by reservation-service to get item details (incl. replacement_cost)
 * when lending an item, to snapshot the cost into StayLoan.
 */
router.get('/items/:itemId', async (req, res, next) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) {
      return res.status(400).json({ success: false, error_code: 'MISSING_TENANT' });
    }
    const { LendableItem } = require('../models');
    const item = await LendableItem.findOne({ where: { id: req.params.itemId, tenant_id } });
    if (!item) return res.status(404).json({ success: false, error_code: 'ITEM_NOT_FOUND' });
    res.json({ id: item.id, name: item.name, replacement_cost: item.replacement_cost });
  } catch (err) { next(err); }
});

module.exports = router;
