const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/charge.controller');
const { authenticate, requirePermission } = require('../middlewares/authenticate');
const { CHARGE_CATEGORIES } = require('../models');

router.use(authenticate);

const addRules = [
  body('folio_id').isUUID(),
  body('category').isIn(CHARGE_CATEGORIES),
  body('amount').isFloat().withMessage('amount puede ser positivo (cargo) o negativo (descuento)'),
  body('description').notEmpty().isLength({ max: 500 }),
];

const voidRules = [body('reason').notEmpty().withMessage('reason es requerido para anulación')];

// GET  /charges/:folioId       — list charges for a folio (?include_voided=true)
// POST /charges                — add charge (negative = discount/regateo)
// POST /charges/:id/void       — soft void

router.get('/:folioId',       requirePermission('BILLING'), ctrl.list);
router.post('/',              requirePermission('BILLING'), addRules, ctrl.add);
router.post('/:id/void',      requirePermission('BILLING'),       voidRules, ctrl.voidCharge);

module.exports = router;
