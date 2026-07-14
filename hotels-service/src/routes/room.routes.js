const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/room.controller');
const { authenticate, requirePermission, enforcePlanRoomLimit } = require('../middlewares/authenticate');
const { ROOM_STATUS } = require('../models');

router.use(authenticate);

const createRules = [
  body('room_type_id').isUUID().withMessage('room_type_id debe ser UUID'),
  body('number').notEmpty().isLength({ max: 10 }),
  body('floor').isInt({ min: 0 }),
];

const massRules = [
  body('room_type_id').isUUID(),
  body('prefix').optional({ checkFalsy: true }).isLength({ max: 5 }),
  body('start').isInt({ min: 0 }),
  body('count').isInt({ min: 1, max: 50 }), // Limit to 50 at a time for safety
];

const statusRules = [
  body('status')
    .isIn([ROOM_STATUS.CLEAN, ROOM_STATUS.DIRTY, ROOM_STATUS.OCCUPIED])
    .withMessage('Estado inválido. Use CLEAN, DIRTY u OCCUPIED'),
];

// GET    /rooms               — list (?status=CLEAN&floor=2)
// GET    /rooms/:id           — detail with open incidents
// POST   /rooms               — create one room
// POST   /rooms/mass          — bulk create range
// PUT    /rooms/:id           — update metadata
// DELETE /rooms/:id           — delete
// PATCH  /rooms/:id/status    — housekeeping status change

router.get('/',           requirePermission('HOTELS_VIEW'),        ctrl.list);
router.get('/:id',        requirePermission('HOTELS_VIEW'),        ctrl.getOne);
router.post('/',          requirePermission('HOTELS_CONFIG'), enforcePlanRoomLimit, createRules, ctrl.create);
router.post('/mass',      requirePermission('HOTELS_CONFIG'), enforcePlanRoomLimit, massRules,   ctrl.massCreate);
router.put('/:id',        requirePermission('HOTELS_CONFIG'),  createRules, ctrl.update);
router.delete('/:id',     requirePermission('HOTELS_CONFIG'),  ctrl.remove);
router.patch('/:id/status', requirePermission('HOUSEKEEPING_UPDATE'), statusRules, ctrl.changeStatus);

module.exports = router;
