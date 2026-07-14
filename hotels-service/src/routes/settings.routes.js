const router = require('express').Router();
const ctrl = require('../controllers/settings.controller');
const { authenticate, requirePermission } = require('../middlewares/authenticate');

router.use(authenticate);

// GET  /settings   — read hotel config
// PUT  /settings   — create or update

router.get('/', requirePermission('HOTELS_VIEW'),   ctrl.get);
router.put('/', requirePermission('HOTELS_CONFIG'), ctrl.upsert);

module.exports = router;
