const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/role.controller');
const { authenticate, requirePermission } = require('../middlewares/authenticate');

router.use(authenticate);

const slugArrayRule = (field) =>
  body(field)
    .isArray().withMessage(`${field} debe ser un array`)
    .custom((arr) => arr.every((s) => typeof s === 'string' && /^[A-Z0-9_]+$/.test(s)))
    .withMessage(`Cada elemento de ${field} debe ser un slug válido`);

const createRules = [
  body('name').notEmpty().withMessage('El nombre del rol es requerido'),
  slugArrayRule('permissions').optional(),
];

const updateRules = [
  body('name').optional().notEmpty(),
  slugArrayRule('permission_slugs').optional(),
];

const reassignRules = [
  slugArrayRule('permissions'),
];

// GET    /roles                       — list (system + tenant)
// GET    /roles/:id                   — detail
// POST   /roles                       — create custom role
// PUT    /roles/:id                   — update name + permissions
// PUT    /roles/:id/permissions        — replace permission set
// DELETE /roles/:id                   — delete (if no active users)

router.get('/',                    requirePermission('ROLES_MANAGE'), ctrl.list);
router.get('/:id',                 requirePermission('ROLES_MANAGE'), ctrl.getOne);
router.post('/',                   requirePermission('ROLES_MANAGE'), createRules,   ctrl.create);
router.put('/:id',                 requirePermission('ROLES_MANAGE'), updateRules,   ctrl.update);
router.put('/:id/permissions',     requirePermission('ROLES_MANAGE'), reassignRules, ctrl.reassignPermissions);
router.delete('/:id',              requirePermission('ROLES_MANAGE'),                ctrl.remove);

module.exports = router;
