const router = require('express').Router();
const { authenticate, requirePermission } = require('../middlewares/authenticate');
const seederSvc = require('../services/seeder.service');

router.use(authenticate);

/**
 * POST /onboarding/seed
 * Called by the owner from the settings page to populate default data.
 */
router.post('/seed', requirePermission('HOTELS_CONFIG'), async (req, res, next) => {
  try {
    const result = await seederSvc.seedHotelDefaults(req.user.tid);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
