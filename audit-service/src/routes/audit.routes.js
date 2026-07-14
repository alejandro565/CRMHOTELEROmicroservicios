const router = require('express').Router();
const { authenticate, requirePermission } = require('../middlewares/index');
const svc = require('../services/audit.service');

router.use(authenticate);

// GET /audit/entity/:entityId     — full history of a reservation/folio/room
// GET /audit/user/:userId         — actions by a specific user (?action=VOID)
// GET /audit                      — full tenant audit (?module=BILLING&action=VOID&from=&to=)
// GET /audit/anomalies            — detect suspicious VOID activity

router.get('/entity/:entityId', requirePermission('AUDIT_VIEW'), async (req, res, next) => {
  try {
    const data = await svc.getAuditByEntity(req.params.entityId, req.user.tid, {
      page:  parseInt(req.query.page  || '1'),
      limit: parseInt(req.query.limit || '50'),
    });
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
});

router.get('/user/:userId', requirePermission('AUDIT_VIEW'), async (req, res, next) => {
  try {
    const data = await svc.getAuditByUser(req.params.userId, req.user.tid, {
      page:   parseInt(req.query.page   || '1'),
      limit:  parseInt(req.query.limit  || '50'),
      action: req.query.action,
    });
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
});

router.get('/', requirePermission('AUDIT_VIEW'), async (req, res, next) => {
  try {
    const { page, limit, module: mod, action, from, to } = req.query;
    const data = await svc.getAuditByTenant(req.user.tid, {
      page:   parseInt(page  || '1'),
      limit:  parseInt(limit || '50'),
      module: mod,
      action,
      from,
      to,
    });
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
});

router.get('/anomalies', requirePermission('AUDIT_VIEW'), async (req, res, next) => {
  try {
    const data = await svc.detectAnomalies(req.user.tid);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

module.exports = router;
