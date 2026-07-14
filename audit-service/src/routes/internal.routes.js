const router = require('express').Router();
const { internalAuth } = require('../middlewares/index');
const { ingestLog }    = require('../services/audit.service');

router.use(internalAuth);

/**
 * POST /internal/logs
 * Used by services that need to log synchronously (guest-service on data edits).
 * Body matches the DATA_CHANGED event shape.
 */
router.post('/logs', async (req, res, next) => {
  try {
    const log = await ingestLog({
      tenant_id:  req.body.tenant_id,
      user_id:    req.body.actor_user_id || req.body.user_id,
      action:     req.body.action   || 'UPDATE',
      module:     req.body.entity   ? req.body.entity.toUpperCase() : (req.body.module || 'RESERVATIONS'),
      entity_id:  req.body.entity_id,
      ip_address: req.ip,
      payload:    req.body.changes ? { after: req.body.changes } : req.body.payload,
      occurred_at: req.body.occurred_at,
    });
    res.status(201).json({ success: true, log_id: log?.id });
  } catch (err) { next(err); }
});

module.exports = router;
