const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/maintenance.controller');
const { authenticate, requirePermission } = require('../middlewares/authenticate');

router.use(authenticate);

const reportRules = [
  body('room_id').isUUID().withMessage('room_id debe ser UUID'),
  body('description').notEmpty().isLength({ max: 1000 }),
  body('item_id').optional().isUUID(),
  body('reservation_id').optional().isUUID(),
];

const closeRules = [
  body('repair_notes').notEmpty().withMessage('repair_notes es requerido'),
  body('repair_cost').optional().isFloat({ min: 0 }),
];

// GET  /maintenance/incidents           — open incidents (?room_id=uuid)
// GET  /maintenance/logs                — historical logs (?room_id=uuid)
// POST /maintenance/incidents           — report damage (sets room → MAINTENANCE)
// POST /maintenance/incidents/:id/close — resolve incident (sets room → DIRTY)

router.get('/incidents',          requirePermission('MAINTENANCE_WRITE'), ctrl.listIncidents);
router.get('/logs',               requirePermission('MAINTENANCE_WRITE'), ctrl.listLogs);
router.post('/incidents',         requirePermission('MAINTENANCE_WRITE'), reportRules, ctrl.reportDamage);
router.post('/incidents/:id/close', requirePermission('MAINTENANCE_WRITE'), closeRules, ctrl.closeIncident);

module.exports = router;
