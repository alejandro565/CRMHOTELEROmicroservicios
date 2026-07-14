const { v4: uuidv4 } = require('uuid');
const { Reservation, ReservationRoom, ReservationGuest, RESERVATION_STATUS } = require('../models');
const { markPreCheckin } = require('./frontoffice.service');
const { updateGuestProfile, createGuestInternal } = require('./guestClient');
const AppError = require('../middlewares/AppError');
const axios = require('axios');

/**
 * Generate a one-time portal token for the guest to self-register
 * their origin data before arrival.
 */
async function generatePortalToken(reservation_id, tenant_id) {
  const reservation = await Reservation.findOne({ where: { id: reservation_id, tenant_id } });
  if (!reservation) throw new AppError('Reserva no encontrada', 404, 'RESERVATION_NOT_FOUND');

  if (![RESERVATION_STATUS.CONFIRMED, RESERVATION_STATUS.PRE_CHECKIN].includes(reservation.status)) {
    throw new AppError('Solo se puede generar token para reservas CONFIRMED o PRE_CHECKIN', 409, 'INVALID_STATUS');
  }

  const hours   = parseInt(process.env.PORTAL_TOKEN_EXPIRES_HOURS || '48', 10);
  const expires = new Date(Date.now() + hours * 60 * 60 * 1000);
  const token   = uuidv4();

  await reservation.update({ guest_portal_token: token, portal_token_expires_at: expires });

  return { token, expires_at: expires };
}

/**
 * Validate portal token and return reservation data for the guest-facing portal.
 */
async function getReservationByToken(token) {
  const reservation = await Reservation.findOne({
    where: { guest_portal_token: token },
    include: [{
      model: ReservationRoom, as: 'rooms',
      include: [{ model: ReservationGuest, as: 'guests' }],
    }],
  });

  if (!reservation) throw new AppError('Token inválido', 404, 'INVALID_PORTAL_TOKEN');

  if (new Date() > reservation.portal_token_expires_at) {
    throw new AppError('El enlace de pre-registro ha expirado', 401, 'PORTAL_TOKEN_EXPIRED');
  }

  // Fetch full profiles for each guest in each room
  const roomsWithProfiles = [];
  for (const room of reservation.rooms) {
    const guestsWithProfiles = [];
    for (const g of room.guests) {
      try {
        // We call guest-service internally (using internal token via axios or client)
        // Since we are in portal.service, we can use the same pattern as validateGuest
        const { data: guestProfile } = await axios.get(`${process.env.GUEST_SERVICE_URL || 'http://guest-service:3004'}/internal/guests/validate/${g.guest_id}`, {
          params: { tenant_id: reservation.tenant_id },
          headers: { 'x-internal-token': process.env.INTERNAL_TOKEN }
        });
        guestsWithProfiles.push({
          ...g.toJSON(),
          profile: guestProfile
        });
      } catch (e) {
        guestsWithProfiles.push({ ...g.toJSON(), profile: { full_name: g.guest_name || 'Huésped' } });
      }
    }
    roomsWithProfiles.push({
      ...room.toJSON(),
      guests: guestsWithProfiles
    });
  }

  const reservationData = reservation.toJSON();
  reservationData.rooms = roomsWithProfiles;

  return reservationData;
}

/**
 * Guest submits their origin data via the portal.
 * Updates ReservationGuest rows with origin_country/city.
 * Transitions reservation to PRE_CHECKIN.
 */
/**
 * Guest submits their data via the portal.
 * This is a "catch-all" submission where the guest provides their profile,
 * and the system finds an available slot in the reservation.
 */
async function submitPortalData(token, guest_profile) {
  const reservation = await Reservation.findOne({
    where: { guest_portal_token: token },
    include: [
      { model: ReservationRoom, as: 'rooms', include: [{ model: ReservationGuest, as: 'guests' }] },
      { model: ReservationGuest, as: 'guest_list' }
    ],
  });

  if (!reservation) throw new AppError('Token inválido o expirado', 404);

  // 1. Find or create guest in guest-service
  const guest = await createGuestInternal(reservation.tenant_id, guest_profile);

  // 2. Check if guest is already in this reservation
  const isAlreadyIn = reservation.guest_list && reservation.guest_list.some(g => g.guest_id === guest.id);
  
  if (!isAlreadyIn) {
    // 3. Assign guest to reservation pool
    await ReservationGuest.create({
      reservation_id: reservation.id,
      res_room_id: null,
      tenant_id:   reservation.tenant_id,
      guest_id:    guest.id,
      guest_name:  `${guest.first_name} ${guest.last_name}`,
      origin_country: guest_profile.origin_country,
      origin_city:    guest_profile.origin_city,
      id_verified:    false
    });
  } else {
    // If already in, just update their data (maybe they are fixing a typo)
    await ReservationGuest.update(
      {
        guest_name:     `${guest.first_name} ${guest.last_name}`,
        origin_country: guest_profile.origin_country,
        origin_city:    guest_profile.origin_city,
      },
      {
        where: {
          guest_id:  guest.id,
          reservation_id: reservation.id,
        },
      }
    );
  }

  // Transition to PRE_CHECKIN if still CONFIRMED
  if (reservation.status === RESERVATION_STATUS.CONFIRMED) {
    await markPreCheckin(reservation.id, reservation.tenant_id);
  }

  return { 
    reservation_id: reservation.id, 
    guest_id: guest.id, 
    status: RESERVATION_STATUS.PRE_CHECKIN 
  };
}

module.exports = { generatePortalToken, getReservationByToken, submitPortalData };
