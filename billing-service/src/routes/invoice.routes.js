const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/invoice.controller');
const { authenticate, requirePermission } = require('../middlewares/authenticate');

router.use(authenticate);

const generateRules = [
  body('nit_ci').notEmpty().withMessage('nit_ci requerido'),
  body('razon_social').notEmpty().isLength({ max: 300 }),
  body('email').optional().isEmail(),
];

// GET  /invoices               — list (?folio_id=uuid)
// POST /invoices/:folioId      — generate fiscal invoice

router.get('/',              requirePermission('BILLING'), ctrl.list);
router.post('/:folioId',     requirePermission('BILLING'),     generateRules, ctrl.generate);

module.exports = router;
