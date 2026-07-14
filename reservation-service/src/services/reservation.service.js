const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const {
  Reservation, ReservationRoom, ReservationGuest, StayLoan,
  RESERVATION_STATUS, LOAN_STATUS
} = require('../models');
const { checkAvailability, blockDates, releaseDates } = require('./availability.service');
const { validateGuest }  = require('./guestClient');
const { updateCharges }  = require('./billingClient');
const {
  publishReservationCreated,
  publishStayExtended,
  publishCheckinCompleted,
} = require('../events/publisher');
const { validateRoomForCheckin, setRoomStatus } = require('./hotelsClient');
const AppError = require('../middlewares/AppError');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _nights(checkIn, checkOut) {
  const ms = new Date(checkOut) - new Date(checkIn);
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function _calcRoomPrice(rate_per_night, checkIn, checkOut, discount, occupants = 1) {
  const nights = _nights(checkIn, checkOut);
  const base   = (rate_per_night * occupants) * nights;
  return parseFloat((base * (1 - discount)).toFixed(2));
}

async function _getReservation(id, tenant_id) {
  const res = await Reservation.findOne({
    where: { id, tenant_id },
    include: [
      { 
        model: ReservationRoom, 
        as: 'rooms', 
        include: [
          { model: ReservationGuest, as: 'guests' },
          { model: StayLoan, as: 'loans', where: { status: LOAN_STATUS.LENT }, required: false }
        ] 
      },
      { model: ReservationGuest, as: 'guest_list' }
    ],
  });
  if (!res) throw new AppError('Reserva no encontrada', 404, 'RESERVATION_NOT_FOUND');
  return res;
}

// ─── Create ───────────────────────────────────────────────────────────────────

/**
 * createReservation — the most complex function in the system.
 *
 * Flow:
 *  1. Validate guest exists → get discount
 *  2. For each room requested: check availability
 *  3. Open a transaction:
 *     a. Create Reservation header
 *     b. For each room: create ReservationRoom + block dates + add primary guest
 *  4. Publish RESERVATION_CREATED (billing opens folio, comm sends email)
 */
async function createReservation({
  tenant_id,
  main_guest_id,
  source,
  status = RESERVATION_STATUS.CONFIRMED,
  rooms,   // [{ room_type_id, room_type_name, room_id, room_number, check_in_date, check_out_date, rate_per_night, adults, children }]
  notes,
  unassigned_guests = [],
  total_price_override
}) {
  // 1. Guest validation + discount
  const guestData      = await validateGuest(main_guest_id, tenant_id);
  const discount       = guestData.best_discount || 0;

  // 2. Availability check for every room (before opening transaction)
  for (const room of rooms) {
    const avail = await checkAvailability(tenant_id, room.room_type_id, room.check_in_date, room.check_out_date);
    if (!avail.available) {
      throw new AppError(
        `Sin disponibilidad para el tipo ${room.room_type_name} en las fechas solicitadas`,
        409, 'NO_AVAILABILITY',
        { room_type_id: room.room_type_id, unavailable_dates: avail.unavailable_dates }
      );
    }
  }

  // 2.1. Physical room validation if checking in immediately
  if (status === RESERVATION_STATUS.IN_HOUSE) {
    for (const room of rooms) {
      if (room.room_id) {
        const val = await validateRoomForCheckin(room.room_id, tenant_id);
        if (!val.can_checkin) {
          throw new AppError(
            `Habitación ${room.room_number || room.room_id} no está lista: ${val.reason}`,
            409, 'ROOM_NOT_READY', { current_status: val.current_status }
          );
        }
      }
    }
  }

  // 3. Transaction: persist everything atomically
  const t = await sequelize.transaction();
  try {
    // Calculate total
    let total_price = 0;
    for (const room of rooms) {
      total_price += _calcRoomPrice(room.rate_per_night, room.check_in_date, room.check_out_date, discount, (room.adults || 1) + (room.children || 0));
    }
    
    if (total_price_override !== undefined && total_price_override !== null) {
      total_price = parseFloat(total_price_override);
    }

    const reservation = await Reservation.create(
      { 
        tenant_id, 
        main_guest_id, 
        main_guest_name: guestData.full_name, // Fix: Store the name for faster queries
        status, 
        source, 
        total_price, 
        discount_applied: discount, 
        pending_balance: total_price, // Initialize pending balance
        notes 
      },
      { transaction: t }
    );

    const createdRooms = [];
    for (let i = 0; i < rooms.length; i++) {
      const room = rooms[i];
      const resRoom = await ReservationRoom.create(
        {
          reservation_id: reservation.id,
          tenant_id,
          room_type_id:   room.room_type_id,
          room_type_name: room.room_type_name,
          room_id:        room.room_id || null,
          room_number:    room.room_number || null,
          check_in_date:  room.check_in_date,
          check_out_date: room.check_out_date,
          rate_per_night: room.rate_per_night,
          adults:         room.adults || 1,
          children:       room.children || 0,
        },
        { transaction: t }
      );

      // Add guests specifically assigned to this room
      if (room.guests && Array.isArray(room.guests)) {
        for (const g of room.guests) {
          await ReservationGuest.create(
            {
              reservation_id: reservation.id,
              res_room_id:    resRoom.id,
              tenant_id,
              guest_id:       g.guest_id,
              guest_name:     g.guest_name || null,
              is_primary:     g.is_primary || false,
              origin_country: g.origin_country || null,
              origin_city:    g.origin_city || null
            },
            { transaction: t }
          );
        }
      }

      // Block availability dates
      await blockDates(tenant_id, room.room_type_id, room.check_in_date, room.check_out_date, 999, t);

      createdRooms.push(resRoom);
    }

    // Add remaining additional guests (those not assigned to a specific room) to the reservation pool
    const assignedGuestIds = rooms.flatMap(r => (r.guests || []).map(g => g.guest_id));
    
    // Always ensure main guest is at least in the pool if not in a room (fallback)
    if (!assignedGuestIds.includes(main_guest_id)) {
      await ReservationGuest.create(
        { 
          reservation_id: reservation.id,
          res_room_id: null, 
          tenant_id, 
          guest_id: main_guest_id, 
          guest_name: guestData.full_name,
          is_primary: true, 
          origin_country: null, 
          origin_city: null 
        },
        { transaction: t }
      );
    }

    const unassignedAdditional = (unassigned_guests || [])
      .filter(ug => ug.guest_id !== main_guest_id && !assignedGuestIds.includes(ug.guest_id));
      
    // Remove duplicates based on guest_id
    const uniqueUnassigned = [];
    const seenIds = new Set();
    for (const ug of unassignedAdditional) {
      if (!seenIds.has(ug.guest_id)) {
        seenIds.add(ug.guest_id);
        uniqueUnassigned.push(ug);
      }
    }
      
    for (const ug of uniqueUnassigned) {
      await ReservationGuest.create(
        { 
          reservation_id: reservation.id,
          res_room_id: null, 
          tenant_id, 
          guest_id: ug.guest_id, 
          is_primary: false, 
          origin_country: ug.origin_country || null, 
          origin_city: ug.origin_city || null 
        },
        { transaction: t }
      );
    }

    await t.commit();

    // 4. Fire events (outside transaction — fire & forget)
    publishReservationCreated({
      tenant_id,
      reservation_id: reservation.id,
      status:         reservation.status,
      guest_id:       main_guest_id,
      total_price,
      rooms: createdRooms.map((r) => ({
        room_type_id:   r.room_type_id,
        check_in_date:  r.check_in_date,
        check_out_date: r.check_out_date,
        rate_per_night: r.rate_per_night,
      })),
    });

    // 5. Update physical room status in hotels-service if IN_HOUSE
    if (status === RESERVATION_STATUS.IN_HOUSE) {
      for (const room of createdRooms) {
        if (room.room_id) {
          await setRoomStatus(room.room_id, tenant_id, 'OCCUPIED');
          
          publishCheckinCompleted({
            tenant_id,
            reservation_id: reservation.id,
            room_id:        room.room_id,
            room_number:    room.room_number,
            guest_id:       main_guest_id,
          });
        }
      }
    }

    return _getReservation(reservation.id, tenant_id);
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

// ─── Read ─────────────────────────────────────────────────────────────────────

async function listReservations(tenant_id, { status, date, page = 1, limit = 20 } = {}) {
  const where = { tenant_id };
  if (status) where.status = status;

  // Filter by arrival date across rooms
  const roomWhere = {};
  if (date) roomWhere.check_in_date = date;

  const { count, rows } = await Reservation.findAndCountAll({
    where,
    include: [{
      model: ReservationRoom, as: 'rooms',
      where: Object.keys(roomWhere).length ? roomWhere : undefined,
      required: !!date,
      include: [
        { model: StayLoan, as: 'loans', where: { status: LOAN_STATUS.LENT }, required: false }
      ]
    }],
    order: [['created_at', 'DESC']],
    limit,
    offset: (page - 1) * limit,
    distinct: true,
  });

  return { total: count, page, total_pages: Math.ceil(count / limit), data: rows };
}

async function getReservation(id, tenant_id) {
  return _getReservation(id, tenant_id);
}

// ─── Edit ─────────────────────────────────────────────────────────────────────

/**
 * editReservation — change dates or notes.
 * Re-checks availability and recalculates price if dates change.
 */
async function editReservation(id, tenant_id, { res_room_id, check_in_date, check_out_date, notes }) {
  const reservation = await _getReservation(id, tenant_id);

  if ([RESERVATION_STATUS.CHECKED_OUT, RESERVATION_STATUS.CANCELED, RESERVATION_STATUS.NOSHOW]
    .includes(reservation.status)) {
    throw new AppError('Esta reserva no puede modificarse', 409, 'RESERVATION_IMMUTABLE');
  }

  if (!res_room_id) {
    // Only notes changed
    await reservation.update({ notes });
    return _getReservation(id, tenant_id);
  }

  const resRoom = reservation.rooms.find((r) => r.id === res_room_id);
  if (!resRoom) throw new AppError('Habitación de reserva no encontrada', 404, 'RES_ROOM_NOT_FOUND');

  // Check new availability
  const avail = await checkAvailability(tenant_id, resRoom.room_type_id, check_in_date, check_out_date);
  if (!avail.available) {
    throw new AppError('Sin disponibilidad para las nuevas fechas', 409, 'NO_AVAILABILITY', {
      unavailable_dates: avail.unavailable_dates,
    });
  }

  const t = await sequelize.transaction();
  try {
    // Release old dates
    await releaseDates(tenant_id, resRoom.room_type_id, resRoom.check_in_date, resRoom.check_out_date, t);

    // Block new dates
    await blockDates(tenant_id, resRoom.room_type_id, check_in_date, check_out_date, 999, t);

    const newPrice = _calcRoomPrice(resRoom.rate_per_night, check_in_date, check_out_date, reservation.discount_applied, resRoom.adults + resRoom.children);
    await resRoom.update({ check_in_date, check_out_date }, { transaction: t });

    // Recalculate total
    let total_price = 0;
    for (const r of reservation.rooms) {
      const cin  = r.id === res_room_id ? check_in_date  : r.check_in_date;
      const cout = r.id === res_room_id ? check_out_date : r.check_out_date;
      total_price += _calcRoomPrice(r.rate_per_night, cin, cout, reservation.discount_applied, r.adults + r.children);
    }

    const delta = total_price - Number(reservation.total_price);
    const new_balance = parseFloat((Number(reservation.pending_balance) + delta).toFixed(2));
    await reservation.update({ total_price, pending_balance: new_balance }, { transaction: t });

    await t.commit();

    // Notify billing
    updateCharges({
      reservation_id: id,
      tenant_id,
      new_total: total_price,
      reason: 'Modification of dates',
      items: [{ concept: `Room ${resRoom.room_type_name} updated`, amount: newPrice }],
    });

    return _getReservation(id, tenant_id);
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

// ─── Cancel ───────────────────────────────────────────────────────────────────

async function cancelReservation(id, tenant_id) {
  const reservation = await _getReservation(id, tenant_id);

  const cancellable = [RESERVATION_STATUS.CONFIRMED, RESERVATION_STATUS.PRE_CHECKIN];
  if (!cancellable.includes(reservation.status)) {
    throw new AppError(
      `No se puede cancelar una reserva en estado ${reservation.status}`,
      409, 'INVALID_STATUS_TRANSITION'
    );
  }

  const t = await sequelize.transaction();
  try {
    for (const room of reservation.rooms) {
      await releaseDates(tenant_id, room.room_type_id, room.check_in_date, room.check_out_date, t);
    }
    await reservation.update({ status: RESERVATION_STATUS.CANCELED }, { transaction: t });
    await t.commit();
    return _getReservation(id, tenant_id);
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

// ─── No-show ──────────────────────────────────────────────────────────────────

async function markNoShow(id, tenant_id) {
  const reservation = await _getReservation(id, tenant_id);

  if (reservation.status !== RESERVATION_STATUS.CONFIRMED) {
    throw new AppError('Solo reservas CONFIRMED pueden marcarse como No-Show', 409, 'INVALID_STATUS_TRANSITION');
  }

  const t = await sequelize.transaction();
  try {
    for (const room of reservation.rooms) {
      await releaseDates(tenant_id, room.room_type_id, room.check_in_date, room.check_out_date, t);
    }
    await reservation.update({ status: RESERVATION_STATUS.NOSHOW }, { transaction: t });
    await t.commit();
    return _getReservation(id, tenant_id);
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

// ─── Extend stay ──────────────────────────────────────────────────────────────

async function extendStay(res_room_id, tenant_id, extra_nights) {
  const resRoom = await ReservationRoom.findOne({
    where: { id: res_room_id, tenant_id },
    include: [
      { model: Reservation, as: 'reservation' },
      { model: ReservationGuest, as: 'guests' }
    ],
  });
  if (!resRoom) throw new AppError('Habitación de reserva no encontrada', 404, 'RES_ROOM_NOT_FOUND');

  const extraNightsNum = parseInt(extra_nights);
  if (isNaN(extraNightsNum) || extraNightsNum <= 0) throw new AppError('Número de noches extra inválido', 400);

  const current_checkout = new Date(resRoom.check_out_date);
  const new_checkout     = new Date(current_checkout);
  new_checkout.setDate(new_checkout.getDate() + extraNightsNum);
  const new_checkout_str = new_checkout.toISOString().split('T')[0];

  // Check availability for the extra nights
  const avail = await checkAvailability(
    tenant_id, resRoom.room_type_id,
    resRoom.check_out_date, new_checkout_str
  );
  if (!avail.available) {
    throw new AppError('Sin disponibilidad para extender la estadía', 409, 'NO_AVAILABILITY', {
      unavailable_dates: avail.unavailable_dates,
    });
  }

  const occupantCount = Math.max(resRoom.adults + resRoom.children, resRoom.guests?.length || 1);
  const extra_charge = parseFloat(
    (resRoom.rate_per_night * occupantCount * extraNightsNum * (1 - resRoom.reservation.discount_applied)).toFixed(2)
  );

  const t = await sequelize.transaction();
  try {
    await blockDates(tenant_id, resRoom.room_type_id, resRoom.check_out_date, new_checkout_str, 999, t);
    await resRoom.update({ check_out_date: new_checkout_str }, { transaction: t });

    // Recalculate total price on the parent reservation
    const new_total = parseFloat(
      (Number(resRoom.reservation.total_price) + extra_charge).toFixed(2)
    );
    const new_balance = parseFloat(
      (Number(resRoom.reservation.pending_balance) + extra_charge).toFixed(2)
    );
    await resRoom.reservation.update({ total_price: new_total, pending_balance: new_balance }, { transaction: t });

    await t.commit();

    publishStayExtended({
      tenant_id,
      reservation_id:  resRoom.reservation_id,
      res_room_id,
      new_checkout:    new_checkout_str,
      extra_nights:    extraNightsNum,
      extra_charge,
    });

    updateCharges({
      reservation_id: resRoom.reservation_id,
      tenant_id,
      new_total,
      reason: 'Extension of stay',
      items: [{ concept: `${extraNightsNum} extra night(s) — ${resRoom.room_type_name}`, amount: extra_charge }],
    });

    return { res_room_id, new_checkout: new_checkout_str, extra_nights: extraNightsNum, extra_charge };
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

// ─── Operational Management ───────────────────────────────────────────────────

/**
 * changeResponsible — Swaps the main_guest_id of a reservation.
 * Sets is_primary = true for the new guest and false for the old one.
 */
async function changeResponsible(id, tenant_id, new_guest_id) {
  const reservation = await _getReservation(id, tenant_id);
  const old_guest_id = reservation.main_guest_id;

  if (old_guest_id === new_guest_id) return reservation;

  const t = await sequelize.transaction();
  try {
    // 0. Get new guest name
    const guestProfile = await validateGuest(new_guest_id, tenant_id);

    // 1. Update header
    await reservation.update({ 
      main_guest_id: new_guest_id,
      main_guest_name: guestProfile.full_name
    }, { transaction: t });

    // 2. Clear is_primary from all guests in this reservation
    await ReservationGuest.update(
      { is_primary: false },
      { where: { reservation_id: id, tenant_id }, transaction: t }
    );

    // 3. Set the new guest as primary in the reservation pool
    const [newGuestEntry] = await ReservationGuest.findOrCreate({
      where: { guest_id: new_guest_id, reservation_id: id, tenant_id },
      defaults: { is_primary: true, guest_name: guestProfile.full_name, res_room_id: null },
      transaction: t
    });

    if (!newGuestEntry.is_primary) {
      await newGuestEntry.update({ is_primary: true }, { transaction: t });
    }

    await t.commit();
    return _getReservation(id, tenant_id);
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

/**
 * updateReservationFinancials — Adjust total_price and discount.
 * Communicates with billing-service to keep folio in sync.
 */
async function updateReservationFinancials(id, tenant_id, { total_price, discount_applied }) {
  const reservation = await Reservation.findOne({ where: { id, tenant_id } });
  if (!reservation) throw new AppError('Reserva no encontrada', 404);

  const t = await sequelize.transaction();
  try {
    const updates = {};
    if (total_price !== undefined) updates.total_price = total_price;
    if (discount_applied !== undefined) updates.discount_applied = discount_applied;

    await reservation.update(updates, { transaction: t });
    await t.commit();

    // Notify billing
    updateCharges({
      reservation_id: id,
      tenant_id,
      new_total: reservation.total_price,
      reason: 'Manual financial adjustment',
    });

    return reservation;
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

async function addGuestToRoom(resRoomId, tenant_id, guest_id) {
  const resRoom = await ReservationRoom.findOne({ 
    where: { id: resRoomId, tenant_id },
    include: [{ model: ReservationGuest, as: 'guests' }]
  });
  if (!resRoom) throw new AppError('Habitación de reserva no encontrada', 404);

  // Check capacity (simple check)
  if (resRoom.guests.length >= (resRoom.adults + resRoom.children + 2)) { // Allowing some margin
     // Optional: hard limit or just warning
  }

  // Get guest name from guest-service
  const guestProfile = await validateGuest(guest_id, tenant_id);

  const [entry, created] = await ReservationGuest.findOrCreate({
    where: { res_room_id: resRoomId, guest_id, tenant_id },
    defaults: { is_primary: false, guest_name: guestProfile.full_name }
  });

  return entry;
}

async function addGuestToReservation(reservation_id, tenant_id, guest_id, res_room_id = null) {
  const reservation = await Reservation.findOne({ where: { id: reservation_id, tenant_id } });
  if (!reservation) throw new AppError('Reserva no encontrada', 404);

  // Get guest name from guest-service
  const guestProfile = await validateGuest(guest_id, tenant_id);

  const [entry, created] = await ReservationGuest.findOrCreate({
    where: { reservation_id, guest_id, tenant_id },
    defaults: { is_primary: false, guest_name: guestProfile.full_name, res_room_id }
  });

  if (!created && res_room_id !== undefined) {
     await entry.update({ res_room_id });
  }

  return entry;
}

async function removeGuestFromReservation(guestResId, tenant_id) {
  const entry = await ReservationGuest.findOne({ where: { id: guestResId, tenant_id } });
  if (!entry) throw new AppError('Huésped no encontrado en esta reserva', 404);

  if (entry.is_primary) {
    throw new AppError('No se puede eliminar al responsable primario directamente. Cambia el responsable primero.', 400);
  }

  await entry.destroy();
  return { success: true };
}

async function updateGuestInReservation(guestResId, tenant_id, data) {
  const entry = await ReservationGuest.findOne({ where: { id: guestResId, tenant_id } });
  if (!entry) throw new AppError('Registro de huésped no encontrado', 404);

  await entry.update(data);
  return entry;
}

async function assignGuestToRoom(guestResId, tenant_id, res_room_id) {
  const entry = await ReservationGuest.findOne({ where: { id: guestResId, tenant_id } });
  if (!entry) throw new AppError('Huésped de reserva no encontrado', 404);

  if (res_room_id) {
    const resRoom = await ReservationRoom.findOne({ where: { id: res_room_id, tenant_id } });
    if (!resRoom) throw new AppError('Habitación de reserva no encontrada', 404);
  }

  await entry.update({ res_room_id: res_room_id || null });
  return entry;
}

async function assignPhysicalRoom(resRoomId, tenant_id, room_id, room_number) {
  const resRoom = await ReservationRoom.findOne({ where: { id: resRoomId, tenant_id } });
  if (!resRoom) throw new AppError('Habitación de reserva no encontrada', 404);

  await resRoom.update({ room_id, room_number });
  return resRoom;
}

async function relocateRoom(resRoomId, tenant_id, { room_type_id, room_type_name, room_id, room_number, rate_per_night, check_in_date, check_out_date }) {
  const resRoom = await ReservationRoom.findOne({
    where: { id: resRoomId, tenant_id },
    include: [
      { model: Reservation, as: 'reservation' },
      { model: ReservationGuest, as: 'guests' }
    ]
  });
  if (!resRoom) throw new AppError('Habitación de reserva no encontrada', 404);

  const t = await sequelize.transaction();
  try {
    const cin  = check_in_date  || resRoom.check_in_date;
    const cout = check_out_date || resRoom.check_out_date;
    const typeId = room_type_id || resRoom.room_type_id;
    
    const occupantCount = Math.max(resRoom.adults + resRoom.children, resRoom.guests?.length || 1);
    const oldPrice = _calcRoomPrice(resRoom.rate_per_night, resRoom.check_in_date, resRoom.check_out_date, resRoom.reservation.discount_applied, occupantCount);
    
    // Always release old dates and block new ones to ensure consistency, even if type is the same but dates changed
    await releaseDates(tenant_id, resRoom.room_type_id, resRoom.check_in_date, resRoom.check_out_date, t);
    
    const avail = await checkAvailability(tenant_id, typeId, cin, cout);
    if (!avail.available) {
      throw new AppError('Sin disponibilidad para la nueva configuración', 409, 'NO_AVAILABILITY', {
        unavailable_dates: avail.unavailable_dates
      });
    }
    await blockDates(tenant_id, typeId, cin, cout, 999, t);

    const newRate = rate_per_night !== undefined ? rate_per_night : resRoom.rate_per_night;
    const newPrice = _calcRoomPrice(newRate, cin, cout, resRoom.reservation.discount_applied, occupantCount);
    
    await resRoom.update({
      room_type_id: typeId,
      room_type_name: room_type_name || resRoom.room_type_name,
      room_id: room_id || null,
      room_number: room_number || null,
      rate_per_night: newRate,
      check_in_date: cin,
      check_out_date: cout
    }, { transaction: t });

    const delta = parseFloat((newPrice - oldPrice).toFixed(2));
    let new_total = Number(resRoom.reservation.total_price);
    
    if (delta !== 0) {
      new_total = parseFloat((Number(resRoom.reservation.total_price) + delta).toFixed(2));
      const new_balance = parseFloat((Number(resRoom.reservation.pending_balance) + delta).toFixed(2));
      await resRoom.reservation.update({ total_price: new_total, pending_balance: new_balance }, { transaction: t });
    }

    await t.commit();

    if (delta !== 0) {
      // Notify billing
      updateCharges({
        reservation_id: resRoom.reservation_id,
        tenant_id,
        new_total,
        reason: 'Room relocation / Date modification',
        items: [{ concept: `Relocation/Mod: ${resRoom.room_type_name} -> ${room_type_name || resRoom.room_type_name}`, amount: delta }],
      });
    }

    return resRoom;
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

module.exports = {
  createReservation,
  listReservations,
  getReservation,
  editReservation,
  cancelReservation,
  markNoShow,
  extendStay,
  changeResponsible,
  updateReservationFinancials,
  addGuestToRoom,
  addGuestToReservation,
  removeGuestFromReservation,
  updateGuestInReservation,
  assignGuestToRoom,
  assignPhysicalRoom,
  relocateRoom
};
