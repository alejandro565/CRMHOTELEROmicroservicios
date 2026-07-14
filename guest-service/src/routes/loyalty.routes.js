const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/loyalty.controller');
const { authenticate, requirePermission } = require('../middlewares/authenticate');

router.use(authenticate);

const createRules = [
  body('name').notEmpty().isLength({ max: 80 }),
  body('min_stays').isInt({ min: 0 }).withMessage('min_stays debe ser entero >= 0'),
  body('discount_percentage')
    .isFloat({ min: 0, max: 1 })
    .withMessage('discount_percentage entre 0 y 1 (ej: 0.10 = 10%)'),
  body('description').optional().isString(),
];

const updateRules = [
  body('name').optional().isLength({ max: 80 }),
  body('min_stays').optional().isInt({ min: 0 }),
  body('discount_percentage').optional().isFloat({ min: 0, max: 1 }),
];

// GET    /loyalty/levels                        — list all levels for tenant
// POST   /loyalty/levels                        — create custom level
// PUT    /loyalty/levels/:id                    — update
// DELETE /loyalty/levels/:id                    — delete (reassigns guests to Normal)
// POST   /loyalty/guests/:guestId/recalculate   — manually trigger recalculation

router.get('/levels',                        requirePermission('LOYALTY_MANAGE'), ctrl.list);
router.post('/levels',                       requirePermission('LOYALTY_MANAGE'), createRules, ctrl.create);
router.put('/levels/:id',                    requirePermission('LOYALTY_MANAGE'), updateRules, ctrl.update);
router.delete('/levels/:id',                 requirePermission('LOYALTY_MANAGE'), ctrl.remove);
router.post('/guests/:guestId/recalculate',  requirePermission('LOYALTY_MANAGE'), ctrl.recalculate);

module.exports = router;
