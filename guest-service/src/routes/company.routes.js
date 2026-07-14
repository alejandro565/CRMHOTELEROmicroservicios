const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/company.controller');
const { authenticate, requirePermission } = require('../middlewares/authenticate');

router.use(authenticate);

const createRules = [
  body('business_name').notEmpty().isLength({ max: 200 }),
  body('tax_id').notEmpty().isLength({ max: 30 }),
  body('email').optional().isEmail(),
  body('corporate_discount')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('corporate_discount debe estar entre 0 y 1 (ej: 0.15 = 15%)'),
];

const updateRules = [
  body('business_name').optional().isLength({ max: 200 }),
  body('email').optional().isEmail(),
  body('corporate_discount').optional().isFloat({ min: 0, max: 1 }),
];

// GET    /companies        — list
// GET    /companies/:id    — detail
// POST   /companies        — create
// PUT    /companies/:id    — update
// DELETE /companies/:id    — delete

router.get('/',     requirePermission('GUESTS_VIEW'),   ctrl.list);
router.get('/:id',  requirePermission('GUESTS_VIEW'),   ctrl.getOne);
router.post('/',    requirePermission('GUESTS_CREATE'),  createRules, ctrl.create);
router.put('/:id',  requirePermission('GUESTS_UPDATE'),  updateRules, ctrl.update);
router.delete('/:id', requirePermission('GUESTS_UPDATE'), ctrl.remove);

module.exports = router;
