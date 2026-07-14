const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/frontoffice.controller');
const { authenticate, requirePermission } = require('../middlewares/authenticate');

router.use(authenticate);

const assignRules = [body('room_id').isUUID().withMessage('room_id debe ser UUID')];
const relocateRules = [body('new_room_id').isUUID().withMessage('new_room_id debe ser UUID')];

// POST /front-office/rooms/:resRoomId/assign    — assign physical room
// POST /front-office/rooms/:resRoomId/relocate  — relocate in-house guest
// POST /front-office/:id/checkin               — process check-in
// POST /front-office/:id/checkout              — process check-out

router.post('/rooms/:resRoomId/assign',   requirePermission('RESERVATIONS_EDIT'),     assignRules,   ctrl.assign);
router.patch('/rooms/:resRoomId/relocate', requirePermission('RESERVATIONS_EDIT'), ctrl.relocate);
router.post('/:id/checkin',              requirePermission('CHECKIN_EXECUTE'),         ctrl.checkIn);
router.post('/:id/checkout',             requirePermission('CHECKOUT_EXECUTE'),        ctrl.checkOut);

module.exports = router;
