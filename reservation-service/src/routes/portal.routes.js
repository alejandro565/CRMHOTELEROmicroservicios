const router = require('express').Router();
const { authenticate, requirePermission } = require('../middlewares/authenticate');
const { generatePortalToken, getReservationByToken, submitPortalData } = require('../services/portal.service');
const AppError = require('../middlewares/AppError');

/**
 * POST /portal/generate/:reservationId  — (authenticated staff) create a portal link
 * GET  /portal/:token                   — (public) guest reads their reservation
 * POST /portal/:token/submit            — (public) guest submits origin data
 */

// Staff generates the token — requires JWT
router.post(
  '/generate/:reservationId',
  authenticate,
  requirePermission('RESERVATIONS_CREATE'),
  async (req, res, next) => {
    try {
      const result = await generatePortalToken(req.params.reservationId, req.user.tid);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }
);

// Guest reads reservation — no JWT, token is the auth mechanism
router.get('/:token', async (req, res, next) => {
  try {
    const reservation = await getReservationByToken(req.params.token);
    // Return safe subset of data (no internal IDs in full)
    res.json({
      success: true,
      data: {
        reservation_id: reservation.id,
        status:         reservation.status,
        rooms: reservation.rooms.map((r) => ({
          id:             r.id,
          room_type_name: r.room_type_name,
          check_in_date:  r.check_in_date,
          check_out_date: r.check_out_date,
          adults:         r.adults,
          children:       r.children,
          guests:         r.guests.map((g) => ({ 
            guest_id:   g.guest_id, 
            is_primary: g.is_primary,
            profile:    g.profile // contains first_name, last_name, email, doc, etc.
          })),
        })),
      },
    });
  } catch (err) { next(err); }
});

// Guest submits origin data — no JWT
router.post('/:token/submit', async (req, res, next) => {
  try {
    const guest_profile = req.body;
    if (!guest_profile || typeof guest_profile !== 'object') {
      return next(new AppError('Datos de huésped requeridos', 400, 'MISSING_GUEST_DATA'));
    }
    const result = await submitPortalData(req.params.token, guest_profile);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

module.exports = router;