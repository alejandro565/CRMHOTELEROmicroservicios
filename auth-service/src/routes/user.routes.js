const router  = require('express').Router();
const { body } = require('express-validator');
const ctrl    = require('../controllers/user.controller');
const { authenticate, requirePermission } = require('../middlewares/authenticate');

router.use(authenticate);

const createRules = [
  body('full_name').notEmpty().withMessage('Nombre completo requerido'),
  body('email').isEmail().withMessage('Email inválido'),
  body('role_id').isUUID().withMessage('role_id debe ser UUID'),
  body('password')
    .isLength({ min: 8 }).withMessage('Contraseña mínimo 8 caracteres')
    .matches(/[A-Z]/).withMessage('Debe incluir una mayúscula')
    .matches(/[0-9]/).withMessage('Debe incluir un número'),
];

const linkRules = [
  body('email').isEmail().withMessage('Email inválido'),
  body('tenant_id').isUUID().withMessage('tenant_id inválido'),
  body('role_id').isUUID().withMessage('role_id inválido'),
];

// ── IMPORTANT: specific static paths MUST come before /:id ──────────────────
// Express matches routes in declaration order. If /:id is declared first,
// it captures "link-tenant" as a param and /:id/tenants never matches.

// GET    /users                    — list employees of current tenant
// POST   /users                    — create employee
// POST   /users/link-tenant        — add existing user to another hotel
router.get('/',             requirePermission('USERS_VIEW'),   ctrl.list);
router.post('/',            requirePermission('USERS_MANAGE'), createRules, ctrl.create);
router.post('/link-tenant', requirePermission('USERS_MANAGE'), linkRules,   ctrl.linkTenant);

// GET    /users/:id                — single employee
// GET    /users/:id/tenants        — all hotels for a user
// PATCH  /users/:id/role           — change role within current hotel
// PATCH  /users/:id/active         — activate / deactivate
// PATCH  /users/:id/unlink-tenant  — remove access to a hotel
router.get('/:id/tenants',       requirePermission('USERS_VIEW'),   ctrl.listTenants);
router.get('/:id',               requirePermission('USERS_VIEW'),   ctrl.getOne);
router.patch('/:id/role',        requirePermission('USERS_MANAGE'), [body('role_id').isUUID()], ctrl.updateRole);
router.patch('/:id/schedule',    requirePermission('USERS_MANAGE'), [body('work_schedule').optional()], ctrl.updateSchedule);
router.patch('/:id/active',      requirePermission('USERS_MANAGE'), ctrl.toggleActive);
router.patch('/:id/unlink-tenant', requirePermission('USERS_MANAGE'), [body('tenant_id').isUUID()], ctrl.unlinkTenant);

module.exports = router;