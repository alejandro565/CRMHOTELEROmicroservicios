const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/lendable.controller');
const { authenticate, requirePermission } = require('../middlewares/authenticate');

router.use(authenticate);

const createRules = [
  body('name').notEmpty().isLength({ max: 120 }),
  body('replacement_cost').isFloat({ min: 0 }),
];

// GET    /lendable-items          — catalog + stock
// GET    /lendable-items/:id      — detail
// POST   /lendable-items          — create item + auto-create inventory row
// PUT    /lendable-items/:id      — update
// DELETE /lendable-items/:id      — delete

router.get('/',     requirePermission('HOTELS_VIEW'),     ctrl.list);
router.get('/:id',  requirePermission('HOTELS_VIEW'),     ctrl.getOne);
router.post('/',    requirePermission('INVENTORY_MANAGE'), createRules, ctrl.create);
router.put('/:id',  requirePermission('INVENTORY_MANAGE'), createRules, ctrl.update);
router.delete('/:id', requirePermission('INVENTORY_MANAGE'), ctrl.remove);

module.exports = router;
