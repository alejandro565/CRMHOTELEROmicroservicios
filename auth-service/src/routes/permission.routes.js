const router = require('express').Router();
const ctrl = require('../controllers/permission.controller');
const { authenticate, requirePermission } = require('../middlewares/authenticate');

// GET  /permissions         — list (grouped by module) — any authenticated user
// POST /permissions         — create (superadmin only via internal tooling)

router.get('/',  authenticate, requirePermission('USERS_MANAGE'), ctrl.list);
router.post('/', authenticate, requirePermission('USERS_MANAGE'), ctrl.create);

module.exports = router;
