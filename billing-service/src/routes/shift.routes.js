const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/shift.controller');
const { authenticate, requirePermission } = require('../middlewares/authenticate');

router.use(authenticate);

// GET  /shifts/current-status         — live arqueo for current cashier
// POST /shifts/open                   — open new shift
// GET  /shifts/:shiftId/status        — arqueo for a specific shift
// POST /shifts/:shiftId/close         — close shift with physical count

router.get('/current-status',          requirePermission('BILLING_VIEW'),   ctrl.currentStatus);
router.post('/open',                   requirePermission('BILLING_ADJUST'),    [body('starting_cash').isFloat({ min: 0 })], ctrl.open);
router.get('/:shiftId/status',         requirePermission('BILLING_VIEW'),   ctrl.status);
router.post('/:shiftId/close',         requirePermission('BILLING_VOID'),   [body('actual_cash').isFloat({ min: 0 })], ctrl.close);

module.exports = router;
