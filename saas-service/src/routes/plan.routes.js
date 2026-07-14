const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/plan.controller');

const createRules = [
  body('name')
    .notEmpty().withMessage('El nombre del plan es requerido')
    .isLength({ max: 100 }),
  body('price')
    .isFloat({ min: 0 }).withMessage('El precio debe ser un número positivo'),
  body('max_rooms')
    .optional()
    .isInt({ min: 0 }).withMessage('max_rooms debe ser entero >= 0 (0 = ilimitado)'),
  body('module_ids')
    .isArray({ min: 1 }).withMessage('Debes incluir al menos un módulo')
    .custom((ids) => ids.every((id) => typeof id === 'string' && /^[A-Z0-9_]+$/.test(id)))
    .withMessage('Cada module_id debe ser un slug válido'),
];

// GET  /api/plans        — list (query: ?active=true)
// GET  /api/plans/:id    — detail
// POST /api/plans        — create

router.get('/',     ctrl.list);
router.get('/:id',  ctrl.getOne);
router.post('/',    createRules, ctrl.create);

module.exports = router;
