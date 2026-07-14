const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/bedType.controller');
const { authenticate, requirePermission } = require('../middlewares/authenticate');

router.use(authenticate);

const bedRules = [
  body('name').notEmpty().withMessage('El nombre es requerido').isLength({ max: 100 }),
  body('description').optional().isLength({ max: 250 }),
];

router.get('/',    requirePermission('HOTELS_VIEW'),   ctrl.list);
router.post('/',   requirePermission('HOTELS_CONFIG'), bedRules, ctrl.create);
router.put('/:id', requirePermission('HOTELS_CONFIG'), bedRules, ctrl.update);
router.delete('/:id', requirePermission('HOTELS_CONFIG'), ctrl.remove);

module.exports = router;
