const router = require('express').Router();
const { internalAuth } = require('../middlewares/authenticate');
const { Guest, GuestStats, LoyaltyLevel, Company } = require('../models');

router.use(internalAuth);

/**
 * GET /internal/guests/validate/:id
 * Called by reservation-service to get guest identity + applicable discount.
 *
 * Response contract:
 * {
 *   guest_id, full_name, civil_status,
 *   loyalty: { level_name, discount_applicable, total_stays },
 *   corporate_discount,   ← from linked company (if any)
 *   best_discount,        ← max(loyalty.discount, corporate_discount)
 *   is_profile_complete,
 *   updated_at
 * }
 */
router.get('/guests/validate/:id', async (req, res, next) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) {
      return res.status(400).json({ success: false, error_code: 'MISSING_TENANT', message: 'tenant_id requerido' });
    }

    const guest = await Guest.findOne({
      where: { id: req.params.id, tenant_id, merged_into_id: null },
      include: [
        {
          model: GuestStats, as: 'stats',
          include: [{ model: LoyaltyLevel, as: 'loyalty_level' }],
        },
        { model: Company, as: 'company', attributes: ['corporate_discount'] },
      ],
    });

    if (!guest) {
      return res.status(404).json({ success: false, error_code: 'GUEST_NOT_FOUND', message: 'Huésped no encontrado' });
    }

    const loyaltyDiscount   = Number(guest.stats?.loyalty_level?.discount_percentage || 0);
    const corporateDiscount = Number(guest.company?.corporate_discount || 0);
    const bestDiscount      = Math.max(loyaltyDiscount, corporateDiscount);

    const is_profile_complete = !!(
      guest.first_name && guest.last_name &&
      guest.doc_type   && guest.doc_number &&
      guest.nationality
    );

    res.json({
      guest_id:    guest.id,
      full_name:   `${guest.first_name} ${guest.last_name}`,
      civil_status: guest.civil_status,
      loyalty: {
        level_name:          guest.stats?.loyalty_level?.name || 'Normal',
        discount_applicable: loyaltyDiscount,
        total_stays:         guest.stats?.total_stays || 0,
      },
      corporate_discount: corporateDiscount,
      best_discount:      bestDiscount,
      is_profile_complete,
      updated_at: guest.updated_at,
    });
  } catch (err) { next(err); }
});

/**
 * GET /internal/guests/by-document
 * Fast lookup used by reservation front-desk flow.
 * Query: ?tenant_id=&doc_type=CI&doc_number=1234567
 */
router.get('/guests/by-document', async (req, res, next) => {
  try {
    const { tenant_id, doc_type, doc_number } = req.query;
    if (!tenant_id || !doc_type || !doc_number) {
      return res.status(400).json({ success: false, error_code: 'MISSING_PARAMS' });
    }

    const guest = await Guest.findOne({
      where: { tenant_id, doc_type, doc_number, merged_into_id: null },
      include: [{ model: GuestStats, as: 'stats', include: [{ model: LoyaltyLevel, as: 'loyalty_level' }] }],
    });

    if (!guest) return res.status(404).json({ success: false, error_code: 'GUEST_NOT_FOUND' });

    res.json({
      guest_id:  guest.id,
      full_name: `${guest.first_name} ${guest.last_name}`,
      doc_type:  guest.doc_type,
      doc_number: guest.doc_number,
      loyalty_level: guest.stats?.loyalty_level?.name || 'Normal',
      discount:  Number(guest.stats?.loyalty_level?.discount_percentage || 0),
    });
  } catch (err) { next(err); }
});

/**
 * PATCH /internal/guests/:id
 * Allows other services (like reservation-service portal) to update guest data.
 */
router.patch('/guests/:id', async (req, res, next) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ success: false, message: 'tenant_id requerido' });

    const guest = await Guest.findOne({ where: { id: req.params.id, tenant_id } });
    if (!guest) return res.status(404).json({ success: false, message: 'Huésped no encontrado' });

    // Filter allowed fields for update via portal/internal
    const allowed = [
      'first_name', 'last_name', 'doc_type', 'doc_number', 
      'email', 'phone', 'nationality', 'gender', 'birth_date', 'civil_status'
    ];
    const updates = {};
    allowed.forEach(key => {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    });

    await guest.update(updates);
    res.json({ success: true, data: guest });
  } catch (err) { next(err); }
});

/**
 * POST /internal/guests
 * Allows reservation-service to create a guest profile during portal registration.
 */
router.post('/guests', async (req, res, next) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ success: false, message: 'tenant_id requerido' });

    // Find or create by document
    console.log(`[guest-service] Internal create/update attempt for tenant: ${tenant_id}`);
    let guest = await Guest.findOne({
      where: {
        tenant_id,
        doc_type:   req.body.doc_type,
        doc_number: req.body.doc_number,
        merged_into_id: null
      }
    });

    if (!guest) {
      guest = await Guest.create({
        ...req.body,
        tenant_id
      });

      // Auto-create stats row linked to default loyalty level
      const defaultLevel = await LoyaltyLevel.findOne({ where: { tenant_id, is_default: true } });
      await GuestStats.create({
        guest_id:                  guest.id,
        tenant_id,
        total_stays:               0,
        total_spent:               0,
        current_loyalty_level_id:  defaultLevel?.id || null,
      });
    } else {
      // Update existing if needed
      await guest.update(req.body);
    }

    res.json({ success: true, data: guest });
  } catch (err) { next(err); }
});

module.exports = router;
