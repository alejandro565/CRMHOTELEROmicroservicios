const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const {
  Reservation, ReservationRoom, ReservationGuest, StayLoan,
  RESERVATION_STATUS, LOAN_STATUS,
} = require('../models');
const { validateRoomForCheckin, setRoomStatus } = require('./hotelsClient');
const { getBalance }   = require('./billingClient');
const {
  publishCheckinCompleted,
  publishCheckoutCompleted,
} = require('../events/publisher');
const AppError = require('../middlewares/AppError');

// ─── Private helper ───────────────────────────────────────────────────────────

async function _getResRoom(res_room_id, tenant_id) {
  const resRoom = await ReservationRoom.findOne({
    where: { id: res_room_id, tenant_id },
    include: [{ model: Reservation, as: 'reservation' }],
  });
  if (!resRoom) throw new AppError('Habitación de reserva no encontrada', 404, 'RES_ROOM_NOT_FOUND');
  return resRoom;
}

// ─── Room assignment ──────────────────────────────────────────────────────────

/**
 * Assign a specific physical room to a reservation slot.
 * Recommended to be done 24h before arrival or at check-in time.
 * Validates that the room is CLEAN in hotels-service before assigning.
 */
async function assignPhysicalRoom(res_room_id, tenant_id, room_id) {
  const resRoom = await _getResRoom(res_room_id, tenant_id);

  if (![RESERVATION_STATUS.CONFIRMED, RESERVATION_STATUS.PRE_CHECKIN].includes(resRoom.reservation.status)) {
    throw new AppError('Solo se puede asignar habitación a reservas CONFIRMED o PRE_CHECKIN', 409, 'INVALID_STATUS');
  }

  // Validate physical room is ready
  const roomStatus = await validateRoomForCheckin(room_id, tenant_id);
  if (!roomStatus.can_checkin) {
    throw new AppError(
      `La habitación no está lista para check-in: ${roomStatus.reason}`,
      409, 'ROOM_NOT_CLEAN',
      { current_status: roomStatus.current_status }
    );
  }

  await resRoom.update({ room_id, room_number: roomStatus.room_number || null });
  return resRoom;
}

/**
 * Relocate a guest already IN_HOUSE to a different physical room.
 */
async function relocateGuest(res_room_id, tenant_id, new_room_id) {
  const resRoom = await _getResRoom(res_room_id, tenant_id);

  if (resRoom.reservation.status !== RESERVATION_STATUS.IN_HOUSE) {
    throw new AppError('El huésped debe estar IN_HOUSE para reubicarlo', 409, 'INVALID_STATUS');
  }

  // Validate new room
  const roomStatus = await validateRoomForCheckin(new_room_id, tenant_id);
  if (!roomStatus.can_checkin) {
    throw new AppError(
      `La nueva habitación no está lista: ${roomStatus.reason}`,
      409, 'ROOM_NOT_CLEAN',
      { current_status: roomStatus.current_status }
    );
  }

  // Mark old room as DIRTY (guest just left it)
  if (resRoom.room_id) await setRoomStatus(resRoom.room_id, tenant_id, 'DIRTY');

  await resRoom.update({ room_id: new_room_id, room_number: roomStatus.room_number || null });

  // Mark new room as OCCUPIED
  await setRoomStatus(new_room_id, tenant_id, 'OCCUPIED');

  return resRoom;
}

// ─── Check-in ─────────────────────────────────────────────────────────────────

async function processCheckIn(reservation_id, tenant_id) {
  const reservation = await Reservation.findOne({
    where: { id: reservation_id, tenant_id },
    include: [{ model: ReservationRoom, as: 'rooms' }],
  });
  if (!reservation) throw new AppError('Reserva no encontrada', 404, 'RESERVATION_NOT_FOUND');

  const checkInable = [RESERVATION_STATUS.CONFIRMED, RESERVATION_STATUS.PRE_CHECKIN];
  if (!checkInable.includes(reservation.status)) {
    throw new AppError(`No se puede hacer check-in desde estado ${reservation.status}`, 409, 'INVALID_STATUS_TRANSITION');
  }

  // All rooms must have a physical room assigned
  const unassigned = reservation.rooms.filter((r) => !r.room_id);
  if (unassigned.length > 0) {
    throw new AppError(
      'Todas las habitaciones deben tener una habitación física asignada antes del check-in',
      409, 'ROOMS_NOT_ASSIGNED',
      { unassigned_count: unassigned.length }
    );
  }

  // Validate each physical room is CLEAN
  for (const room of reservation.rooms) {
    const status = await validateRoomForCheckin(room.room_id, tenant_id);
    if (!status.can_checkin) {
      throw new AppError(
        `Habitación ${room.room_number || room.room_id} no está CLEAN`,
        409, 'ROOM_NOT_CLEAN',
        { room_id: room.room_id, current_status: status.current_status }
      );
    }
  }

  await reservation.update({ status: RESERVATION_STATUS.IN_HOUSE });

  // Mark all physical rooms as OCCUPIED
  for (const room of reservation.rooms) {
    await setRoomStatus(room.room_id, tenant_id, 'OCCUPIED');

    publishCheckinCompleted({
      tenant_id,
      reservation_id,
      room_id:     room.room_id,
      room_number: room.room_number,
      guest_id:    reservation.main_guest_id,
    });
  }

  return reservation;
}

// ─── Check-out ────────────────────────────────────────────────────────────────

async function processCheckOut(reservation_id, tenant_id) {
  const reservation = await Reservation.findOne({
    where: { id: reservation_id, tenant_id },
    include: [{
      model: ReservationRoom, as: 'rooms',
      include: [{ model: ReservationGuest, as: 'guests' }],
    }],
  });
  if (!reservation) throw new AppError('Reserva no encontrada', 404, 'RESERVATION_NOT_FOUND');

  if (reservation.status !== RESERVATION_STATUS.IN_HOUSE) {
    throw new AppError('Solo reservas IN_HOUSE pueden hacer check-out', 409, 'INVALID_STATUS_TRANSITION');
  }

  // Guard 1: open loans block checkout
  for (const room of reservation.rooms) {
    const openLoans = await StayLoan.count({
      where: { res_room_id: room.id, status: LOAN_STATUS.LENT },
    });
    if (openLoans > 0) {
      throw new AppError(
        `La habitación ${room.room_number || room.id} tiene ${openLoans} préstamo(s) pendiente(s) de devolución`,
        409, 'OPEN_LOANS_PENDING',
        { res_room_id: room.id, open_loans: openLoans }
      );
    }
  }

  // Guard 2: billing balance must be zero
  const billing = await getBalance(reservation_id, tenant_id);
  if (billing.has_pending || billing.balance > 0) {
    throw new AppError(
      `Saldo pendiente de Bs ${billing.balance}. Saldar la cuenta antes del check-out.`,
      409, 'PENDING_BALANCE',
      { balance: billing.balance }
    );
  }

  await reservation.update({ status: RESERVATION_STATUS.CHECKED_OUT });

  for (const room of reservation.rooms) {
    // Physical room → DIRTY
    if (room.room_id) await setRoomStatus(room.room_id, tenant_id, 'DIRTY');

    publishCheckoutCompleted({
      tenant_id,
      reservation_id,
      room_id:      room.room_id,
      guest_id:     reservation.main_guest_id,
      amount_spent: Number(reservation.total_price),
    });
  }

  return reservation;
}

// ─── Guest portal status transition ──────────────────────────────────────────

async function markPreCheckin(reservation_id, tenant_id) {
  const reservation = await Reservation.findByPk(reservation_id);
  if (!reservation || reservation.tenant_id !== tenant_id) {
    throw new AppError('Reserva no encontrada', 404, 'RESERVATION_NOT_FOUND');
  }
  if (reservation.status !== RESERVATION_STATUS.CONFIRMED) {
    throw new AppError('Solo reservas CONFIRMED pueden pasar a PRE_CHECKIN', 409, 'INVALID_STATUS_TRANSITION');
  }
  await reservation.update({ status: RESERVATION_STATUS.PRE_CHECKIN });
  return reservation;
}

module.exports = {
  assignPhysicalRoom,
  relocateGuest,
  processCheckIn,
  processCheckOut,
  markPreCheckin,
};
