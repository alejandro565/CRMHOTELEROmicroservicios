const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/amenity.controller');
const { authenticate, requirePermission } = require('../middlewares/authenticate');

router.use(authenticate);

const amenityRules = [
  body('name').notEmpty().withMessage('El nombre es requerido').isLength({ max: 100 }),
  body('description').optional().isLength({ max: 250 }),
  body('icon').optional().isLength({ max: 50 }),
];

router.get('/',    requirePermission('HOTELS_VIEW'),   ctrl.list);
router.post('/',   requirePermission('HOTELS_CONFIG'), amenityRules, ctrl.create);
router.put('/:id', requirePermission('HOTELS_CONFIG'), amenityRules, ctrl.update);
router.delete('/:id', requirePermission('HOTELS_CONFIG'), ctrl.remove);

module.exports = router;
