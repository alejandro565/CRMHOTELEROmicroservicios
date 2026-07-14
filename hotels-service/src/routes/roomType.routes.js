const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/roomType.controller');
const { authenticate, requirePermission } = require('../middlewares/authenticate');

router.use(authenticate);

const createRules = [
  body('name').notEmpty().withMessage('El nombre es requerido').isLength({ max: 100 }),
  body('base_price').isFloat({ min: 0 }).withMessage('base_price debe ser positivo'),
  body('max_capacity').optional().isInt({ min: 1 }),
  body('bathroom_type').isIn(['PRIVATE', 'SHARED', 'NONE']).withMessage('Tipo de baño inválido'),
  body('amenity_ids').optional().isArray().withMessage('amenity_ids debe ser un arreglo'),
  body('beds').optional().isArray().withMessage('beds debe ser un arreglo'),
  body('beds.*.bed_type_id').if(body('beds').exists()).isUUID().withMessage('bed_type_id debe ser UUID'),
  body('beds.*.count').if(body('beds').exists()).isInt({ min: 1 }).withMessage('Cantidad de camas debe ser mayor a 0'),
];

// GET    /room-types          — list all types for this tenant
// GET    /room-types/:id      — detail
// POST   /room-types          — create
// PUT    /room-types/:id      — update
// DELETE /room-types/:id      — delete (guard: no rooms using it)

router.get('/',     requirePermission('HOTELS_VIEW'),   ctrl.list);
router.get('/:id',  requirePermission('HOTELS_VIEW'),   ctrl.getOne);
router.post('/',    requirePermission('HOTELS_CONFIG'),  createRules, ctrl.create);
router.put('/:id',  requirePermission('HOTELS_CONFIG'),  createRules, ctrl.update);
router.delete('/:id', requirePermission('HOTELS_CONFIG'), ctrl.remove);

module.exports = router;
