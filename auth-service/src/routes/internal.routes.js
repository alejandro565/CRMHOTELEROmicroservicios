const router = require('express').Router();
const { internalAuth } = require('../middlewares/authenticate');
const userService = require('../services/user.service');

router.use(internalAuth);

/**
 * POST /internal/setup-admin
 * Called by saas-service during hotel provisioning.
 *
 * Behavior:
 *  - If email is NEW  → creates LocalTenant + User + UserTenant
 *  - If email EXISTS  → links existing user to the new tenant (second hotel)
 *
 * Body: {
 *   tenant_id,
 *   admin_user:    { email, full_name, initial_password, must_change_password },
 *   tenant_config: { plan_name, max_hotels, max_rooms_per_hotel, active_modules },
 *   metadata:      { reason, created_at }
 * }
 */
router.post('/setup-admin', async (req, res, next) => {
  try {
    const { tenant_id, admin_user, tenant_config } = req.body;

    if (!tenant_id || !admin_user?.email || !admin_user?.initial_password) {
      return res.status(400).json({
        success:    false,
        error_code: 'MISSING_FIELDS',
        message:    'tenant_id, admin_user.email y admin_user.initial_password son requeridos',
      });
    }

    const result = await userService.setupInitialAdmin({
      tenant_id,
      email:               admin_user.email,
      full_name:           admin_user.full_name || '',
      initial_password:    admin_user.initial_password,
      hotel_name:          req.body.hotel_name || null,
      plan_name:           tenant_config?.plan_name,
      max_hotels:          tenant_config?.max_hotels          ?? 1,
      max_rooms_per_hotel: tenant_config?.max_rooms_per_hotel ?? 0,
      active_modules:      tenant_config?.active_modules      || [],
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /internal/setup-tenant-for-owner
 * Called by saas-service when an Owner adds a hotel.
 * Uses owner_id (not email) to find the user and link them to the new tenant.
 *
 * Body: {
 *   tenant_id, owner_id, hotel_name,
 *   tenant_config: { plan_name, max_hotels, max_rooms_per_hotel, active_modules }
 * }
 */
router.post('/setup-tenant-for-owner', async (req, res, next) => {
  try {
    const { tenant_id, owner_id, hotel_name, tenant_config } = req.body;

    if (!tenant_id || !owner_id) {
      return res.status(400).json({
        success:    false,
        error_code: 'MISSING_FIELDS',
        message:    'tenant_id y owner_id son requeridos',
      });
    }

    const { LocalTenant, UserTenant, Role, TENANT_STATUS } = require('../models');
    const { sequelize } = require('../config/database');

    const t = await sequelize.transaction();
    try {
      // Upsert local tenant mirror
      const [tenant] = await LocalTenant.findOrCreate({
        where:    { id: tenant_id },
        defaults: {
          hotel_name:          hotel_name || null,
          status:              TENANT_STATUS.ACTIVE,
          plan_name:           tenant_config?.plan_name,
          max_hotels:          tenant_config?.max_hotels          ?? 1,
          max_rooms_per_hotel: tenant_config?.max_rooms_per_hotel ?? 0,
          active_modules:      tenant_config?.active_modules      || [],
        },
        transaction: t,
      });

      // Get TENANT_ADMIN role
      const adminRole = await Role.findOne({
        where: { name: 'TENANT_ADMIN', tenant_id: null }, transaction: t,
      });
      if (!adminRole) throw new Error('Rol TENANT_ADMIN no encontrado');

      // Link the owner to this tenant
      const alreadyLinked = await UserTenant.findOne({
        where: { user_id: owner_id, tenant_id }, transaction: t,
      });

      if (!alreadyLinked) {
        await UserTenant.create(
          { user_id: owner_id, tenant_id, role_id: adminRole.id, is_active: true },
          { transaction: t }
        );
      }

      await t.commit();
      res.status(201).json({ success: true, data: { tenant_id, owner_id, linked: !!alreadyLinked } });
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (err) { next(err); }
});

module.exports = router;
  