const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/module.controller');

const createRules = [
  body('id')
    .notEmpty().withMessage('El slug (id) es requerido')
    .matches(/^[A-Z0-9_]+$/).withMessage('El slug solo acepta mayúsculas, números y guiones bajos'),
  body('name')
    .notEmpty().withMessage('El nombre es requerido')
    .isLength({ max: 100 }),
  body('description').optional().isString(),
  body('is_active').optional().isBoolean(),
];

// GET  /api/modules          — list all (query: ?active=true)
// POST /api/modules          — register new module
// PATCH /api/modules/:id     — toggle is_active

router.get('/',        ctrl.list);
router.post('/',       createRules, ctrl.create);
router.patch('/:id',   ctrl.toggle);

module.exports = router;
