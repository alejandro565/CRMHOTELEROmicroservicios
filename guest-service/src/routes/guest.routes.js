const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/guest.controller');
const { authenticate, requirePermission } = require('../middlewares/authenticate');
const { DOC_TYPES, CIVIL_STATUS } = require('../models');

router.use(authenticate);

const createRules = [
  body('first_name').notEmpty().withMessage('Nombre es requerido').isLength({ max: 100 }),
  body('last_name').notEmpty().withMessage('Apellido es requerido').isLength({ max: 100 }),
  body('doc_type').isIn(DOC_TYPES).withMessage(`doc_type debe ser: ${DOC_TYPES.join(', ')}`),
  body('doc_number').notEmpty().withMessage('Documento es requerido').isLength({ max: 50 }),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Email inválido'),
  body('phone').optional({ checkFalsy: true }).isLength({ max: 30 }),
  body('nationality').optional({ checkFalsy: true }),
  body('gender').optional().isIn(['M', 'F', 'OTHER']),
  body('birth_date').optional({ checkFalsy: true }).notEmpty(),
  body('civil_status').optional().isIn(CIVIL_STATUS),
];

const updateRules = [
  body('first_name').optional(),
  body('last_name').optional(),
  body('email').optional(),
  body('civil_status').optional(),
  body('nationality').optional(),
  body('gender').optional(),
  body('birth_date').optional(),
];

const mergeRules = [
  body('duplicate_id').isUUID().withMessage('duplicate_id debe ser UUID'),
];

const docRules = [
  body('document_url').notEmpty().withMessage('document_url es requerido'),
  body('doc_type').isIn(DOC_TYPES),
  body('expiry_date').optional().isDate(),
];

// GET    /guests                      — list + search (?search=juan&page=1)
// GET    /guests/search               — lookup by document (?doc_type=CI&doc_number=123)
// GET    /guests/:id                  — full profile
// POST   /guests                      — create
// PUT    /guests/:id                  — update
// DELETE /guests/:id                  — soft delete
// POST   /guests/:id/merge            — merge duplicate into main
// POST   /guests/:id/documents        — attach document scan
// DELETE /guests/:id/documents/:docId — remove scan

router.get('/', requirePermission('GUESTS_VIEW'), ctrl.list);
router.get('/search', requirePermission('GUESTS_VIEW'), ctrl.search);
router.get('/:id', requirePermission('GUESTS_VIEW'), ctrl.getOne);
router.post('/', requirePermission('GUESTS_CREATE'), createRules, ctrl.create);
router.put('/:id', requirePermission('GUESTS_UPDATE'), updateRules, ctrl.update);
router.delete('/:id', requirePermission('GUESTS_UPDATE'), ctrl.remove);
router.post('/:id/merge', requirePermission('GUESTS_MERGE'), mergeRules, ctrl.merge);
router.post('/:id/documents', requirePermission('GUESTS_UPDATE'), docRules, ctrl.addDocument);
router.delete('/:id/documents/:docId', requirePermission('GUESTS_UPDATE'), ctrl.removeDocument);

module.exports = router;