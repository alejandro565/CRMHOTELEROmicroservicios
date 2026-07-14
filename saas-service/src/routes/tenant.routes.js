const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/tenant.controller');
const { authenticate, requireRole, requirePermission } = require('../middlewares/authenticate');

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

const updateRules = [
  body('name').optional().isLength({ max: 200 }),
  body('tax_id').optional().isLength({ max: 30 }),
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
router.get('/mine', authenticate, requirePermission('OWNER_VIEW_HOTELS'), ctrl.listMine);
router.post('/first', authenticate, requirePermission('OWNER_CREATE_HOTEL'), firstHotelRules, ctrl.createFirst);

// Additional hotel — owner only, plan comes from their existing hotels
router.post('/',    authenticate, requirePermission('OWNER_CREATE_HOTEL'), addHotelRules, ctrl.create);

// Admin / read routes — authenticate but no role restriction yet
router.get('/',     authenticate, ctrl.list);
router.get('/:id',  authenticate, ctrl.getOne);

// Lifecycle — owner or admin
router.patch('/:id/suspend',    authenticate, suspendRules,    ctrl.suspend);
router.patch('/:id/reactivate', authenticate,                  ctrl.reactivate);
router.patch('/:id/plan',       authenticate, requirePermission('OWNER_MANAGE_PLAN'), changePlanRules, ctrl.changePlan);
router.patch('/:id',           authenticate, requirePermission('OWNER_CREATE_HOTEL'), updateRules, ctrl.update);
router.delete('/:id',           authenticate, requirePermission('OWNER_DELETE_HOTEL'), ctrl.softDelete);

module.exports = router;
