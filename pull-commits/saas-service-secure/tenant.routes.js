const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/tenant.controller');
const { authenticate, requireRole } = require('../middlewares/authenticate');

const firstHotelRules = [
  body('plan_id').isUUID().withMessage('plan_id debe ser un UUID válido'),
  body('name').notEmpty().withMessage('El nombre del hotel es requerido').isLength({ max: 200 }),
  body('tax_id').notEmpty().withMessage('El NIT es requerido').isLength({ max: 30 }),
];

const addHotelRules = [
  body('name').notEmpty().withMessage('El nombre del hotel es requerido').isLength({ max: 200 }),
  body('tax_id').notEmpty().withMessage('El NIT es requerido').isLength({ max: 30 }),
];

const suspendRules = [
  body('reason').optional().isString().isLength({ max: 500 }),
];

const changePlanRules = [
  body('plan_id').isUUID().withMessage('plan_id debe ser un UUID válido'),
];

// ── Owner routes (require OWNER role from JWT) ────────────────────────────────
//
// POST   /api/tenants/first         — create first hotel (includes plan selection)
// POST   /api/tenants               — add another hotel (plan inherited)
// GET    /api/tenants/mine          — list own hotels
// DELETE /api/tenants/:id           — soft delete own hotel
// PATCH  /api/tenants/:id/plan      — upgrade/downgrade plan (affects all own hotels)
//
// ── Admin routes (could add SUPER_ADMIN role check later) ────────────────────
//
// GET    /api/tenants               — list all hotels (admin view)
// GET    /api/tenants/:id           — hotel detail
// PATCH  /api/tenants/:id/suspend   — suspend hotel
// PATCH  /api/tenants/:id/reactivate — reactivate hotel

// Static paths first to avoid /:id catching them
router.get('/mine', authenticate, requireRole('OWNER'), ctrl.listMine);
router.post('/first', authenticate, requireRole('OWNER'), firstHotelRules, ctrl.createFirst);

// Additional hotel — owner only, plan comes from their existing hotels
router.post('/',    authenticate, requireRole('OWNER'), addHotelRules, ctrl.create);

// Admin / read routes — authenticate but no role restriction yet
router.get('/',     authenticate, ctrl.list);
router.get('/:id',  authenticate, ctrl.getOne);

// Lifecycle — owner or admin
router.patch('/:id/suspend',    authenticate, suspendRules,    ctrl.suspend);
router.patch('/:id/reactivate', authenticate,                  ctrl.reactivate);
router.patch('/:id/plan',       authenticate, requireRole('OWNER'), changePlanRules, ctrl.changePlan);
router.delete('/:id',           authenticate, requireRole('OWNER'), ctrl.softDelete);

module.exports = router;
