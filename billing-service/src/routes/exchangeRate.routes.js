const router = require('express').Router();
const ctrl = require('../controllers/exchangeRate.controller');
const { authenticate, requirePermission } = require('../middlewares/authenticate');

router.use(authenticate);

// GET  /exchange-rates                — list all (latest per currency)
// GET  /exchange-rates/:currency      — get current rate for a currency
// POST /exchange-rates                — set/update rate for today

router.get('/',              requirePermission('BILLING'), ctrl.list);
router.get('/:currency',     requirePermission('BILLING'),  ctrl.getCurrent);
router.post('/',             requirePermission('BILLING'), ctrl.set);

module.exports = router;
