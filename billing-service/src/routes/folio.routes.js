const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/folio.controller');
const { authenticate, requirePermission } = require('../middlewares/authenticate');
const { CHARGE_CATEGORIES } = require('../models');

router.use(authenticate);

const routeRules = [
  body('charge_id').isUUID(),
  body('target_folio_id').isUUID(),
];

const routingRuleRules = [
  body('target_folio_id').isUUID(),
  body('category_to_move').isIn(CHARGE_CATEGORIES).withMessage(`Categoría debe ser: ${CHARGE_CATEGORIES.join(', ')}`),
];

const settleRules = [
  body('payment').optional().isObject(),
];

// GET  /folios/reservation/:reservationId  — list folios for a reservation
// GET  /folios/:id                         — folio detail with charges + payments
// POST /folios/:id/recalc                  — force recalculate balance
// POST /folios/:id/route                   — move a charge between folios
// POST /folios/:id/routing-rules           — set auto-routing rule for category
// POST /folios/:id/settle                  — pay + optionally invoice

router.get('/',                            requirePermission('BILLING'),   ctrl.listAll);
router.get('/reservation/:reservationId', requirePermission('BILLING'),   ctrl.byReservation);
router.get('/:id',                        requirePermission('BILLING'),   ctrl.getOne);
router.post('/:id/recalc',               requirePermission('BILLING'), ctrl.recalcBalance);
router.post('/:id/route',                requirePermission('BILLING'), routeRules,       ctrl.route);
router.post('/:id/routing-rules',        requirePermission('BILLING'), routingRuleRules, ctrl.setRoutingRule);
router.post('/:id/settle',               requirePermission('BILLING'),   settleRules,      ctrl.settle);

module.exports = router;
