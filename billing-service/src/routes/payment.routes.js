const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/payment.controller');
const { authenticate, requirePermission } = require('../middlewares/authenticate');
const { PAYMENT_METHOD } = require('../models');

router.use(authenticate);

const addRules = [
  body('method').isIn(PAYMENT_METHOD).withMessage(`method debe ser: ${PAYMENT_METHOD.join(', ')}`),
  body('amount').isFloat().custom(val => parseFloat(val) !== 0).withMessage('monto no puede ser cero'),
  body('currency').optional().isLength({ min: 3, max: 3 }),
];

const voidRules = [body('reason').notEmpty()];

// GET  /payments/:folioId         — list payments for a folio
// POST /payments/:folioId         — register payment on a folio
// POST /payments/:id/void         — void payment

router.get('/',               requirePermission('BILLING'),  ctrl.listAll);
router.get('/:folioId',       requirePermission('BILLING'),  ctrl.list);
router.post('/:folioId',      requirePermission('BILLING'),  addRules, ctrl.add);
router.post('/:id/void',      requirePermission('BILLING'),       voidRules, ctrl.voidPayment);

module.exports = router;
