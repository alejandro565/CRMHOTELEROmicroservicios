const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/reservation.controller');
const { authenticate, requirePermission } = require('../middlewares/authenticate');
const { RESERVATION_SOURCE, RESERVATION_STATUS } = require('../models');

router.use(authenticate);

const roomRule = [
  body('rooms').isArray({ min: 1 }).withMessage('Debe incluir al menos una habitación'),
  body('rooms.*.room_type_id').isUUID(),
  body('rooms.*.room_type_name').notEmpty(),
  body('rooms.*.check_in_date').isDate(),
  body('rooms.*.check_out_date').isDate(),
  body('rooms.*.rate_per_night').isFloat({ min: 0 }),
];

const createRules = [
  body('main_guest_id').isUUID(),
  body('status').optional().isIn(Object.values(RESERVATION_STATUS)),
  body('source').notEmpty(),
  body('total_price_override').optional(),
  body('rooms').isArray({ min: 1 }),
  body('rooms.*.room_type_id').isUUID(),
  body('rooms.*.room_type_name').notEmpty(),
  body('rooms.*.check_in_date').notEmpty(),
  body('rooms.*.check_out_date').notEmpty(),
  body('rooms.*.rate_per_night').optional(),
  body('rooms.*.adults').optional(),
  body('rooms.*.children').optional(),
];

const editRules = [
  body('res_room_id').optional().isUUID(),
  body('check_in_date').optional().isDate(),
  body('check_out_date').optional().isDate(),
];

const extendRules = [
  body('extra_nights').isInt({ min: 1 }).withMessage('extra_nights debe ser entero >= 1'),
];

// GET    /reservations                        — list (?status=IN_HOUSE&date=2024-01-10)
// GET    /reservations/:id                    — detail
// POST   /reservations                        — create
// PUT    /reservations/:id                    — edit dates / notes
// PATCH  /reservations/:id/cancel             — cancel
// PATCH  /reservations/:id/noshow             — mark no-show
// PATCH  /reservations/rooms/:resRoomId/extend — extend stay

// Operational
// PATCH  /reservations/:id/change-responsible  - Swap main guest
// PATCH  /reservations/:id/finances            - Update price/discount
// POST   /reservations/rooms/:resRoomId/guests  - Add guest
// DELETE /reservations/rooms/:resRoomId/guests/:guestId - Remove guest
// PATCH  /reservations/guests/:guestResId      - Update guest data (verified, origin)
// POST   /reservations/:id/notify              - Send portal link

router.get('/',                               requirePermission('RESERVATIONS_VIEW'),   ctrl.list);
router.get('/:id',                            requirePermission('RESERVATIONS_VIEW'),   ctrl.getOne);
router.post('/',                              requirePermission('RESERVATIONS_CREATE'),  createRules, ctrl.create);
router.put('/:id',                            requirePermission('RESERVATIONS_EDIT'),   editRules,   ctrl.edit);
router.patch('/:id/cancel',                   requirePermission('RESERVATIONS_STATUS'),  ctrl.cancel);
router.patch('/:id/noshow',                   requirePermission('RESERVATIONS_STATUS'),  ctrl.noShow);
router.patch('/rooms/:resRoomId/extend',      requirePermission('RESERVATIONS_EDIT'),   extendRules, ctrl.extend);

// Operational routes
router.patch('/:id/change-responsible',       requirePermission('RESERVATIONS_EDIT'),   ctrl.changeMainGuest);
router.patch('/:id/finances',                 requirePermission('RESERVATIONS_EDIT'),   ctrl.updateFinances);
router.post('/rooms/:resRoomId/guests',       requirePermission('RESERVATIONS_EDIT'),   ctrl.addGuest);
router.delete('/guests/:guestResId',          requirePermission('RESERVATIONS_EDIT'),   ctrl.removeGuest);
router.patch('/guests/:guestResId',           requirePermission('RESERVATIONS_EDIT'),   ctrl.updateGuestData);
router.patch('/guests/:guestResId/assign',    requirePermission('RESERVATIONS_EDIT'),   ctrl.assignGuestToRoom);
router.patch('/rooms/:resRoomId/assign-physical', requirePermission('RESERVATIONS_EDIT'), ctrl.assignPhysicalRoom);
router.post('/:id/guests',                    requirePermission('RESERVATIONS_EDIT'),   ctrl.addGuestToReservation);
router.post('/:id/notify',                   requirePermission('RESERVATIONS_VIEW'),   ctrl.notifyPortal);

module.exports = router;
