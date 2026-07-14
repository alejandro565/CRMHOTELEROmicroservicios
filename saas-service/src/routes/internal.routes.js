const router = require('express').Router();
const internalAuth = require('../middlewares/internalAuth');
const tenantService = require('../services/tenant.service');
const AppError = require('../middlewares/AppError');

// All /internal routes require the x-internal-token header
router.use(internalAuth);

/**
 * GET /internal/tenants/:id/status
 * Ultra-fast check used by hotels-service, billing-service, etc.
 * before processing any tenant request.
 */
router.get('/tenants/:id/status', async (req, res, next) => {
  try {
    const result = await tenantService.getTenantStatus(req.params.id);
    if (!result.exists) {
      throw new AppError('Tenant no encontrado', 404, 'TENANT_NOT_FOUND');
    }
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
