const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/inventory.controller');
const { authenticate, requirePermission } = require('../middlewares/authenticate');

router.use(authenticate);

const adjustRules = [
  body('qty').isInt().withMessage('qty debe ser un entero (positivo = entrada, negativo = salida)'),
  body('reason')
    .isIn(['PURCHASE', 'WRITE_OFF', 'DAMAGE_REPAIR', 'CORRECTION'])
    .withMessage('reason inválido'),
];

// PATCH /inventory/:itemId/adjust  — stock adjustment

router.patch('/:itemId/adjust', requirePermission('INVENTORY_MANAGE'), adjustRules, ctrl.adjust);

module.exports = router;
