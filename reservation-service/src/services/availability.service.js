const { Op } = require('sequelize');
const { AvailabilityBlock } = require('../models');
const { sequelize } = require('../config/database');
const AppError = require('../middlewares/AppError');

/**
 * Generate all calendar dates between two DATEONLY strings (exclusive of check_out_date
 * since the guest leaves on that day — the night of check_out_date is not occupied).
 */
function _dateRange(checkIn, checkOut, paddingDays = 0) {
  const dates = [];
  const current = new Date(checkIn);
  const end     = new Date(checkOut);
  end.setDate(end.getDate() + paddingDays);
  while (current < end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/**
 * Check if a room type has availability for every night in the date range.
 * Returns { available: boolean, nights: number, unavailable_dates: string[] }
 */
async function checkAvailability(tenant_id, room_type_id, check_in_date, check_out_date, options = {}) {
  const nights = _dateRange(check_in_date, check_out_date, 2); // 2 days padding for preparation
  if (nights.length === 0) throw new AppError('El rango de fechas es inválido', 400, 'INVALID_DATE_RANGE');

  const blocks = await AvailabilityBlock.findAll({
    where: {
      tenant_id,
      room_type_id,
      date: { [Op.in]: nights },
    },
    transaction: options.transaction
  });

  const unavailable = [];
  for (const night of nights) {
    const block = blocks.find((b) => b.date === night);
    // If no block exists yet → not initialized → treat as available
    if (block && block.available_count <= 0) unavailable.push(night);
  }

  return {
    available:          unavailable.length === 0,
    nights:             _dateRange(check_in_date, check_out_date, 0).length, // real nights, no padding
    unavailable_dates:  unavailable,
    check_in_date,
    check_out_date,
  };
}

/**
 * Check availability for all room types in the date range.
 * Returns an object with room_type_id as keys, and available quantity as values.
 */
async function checkAllAvailability(tenant_id, check_in_date, check_out_date) {
  const nights = _dateRange(check_in_date, check_out_date, 2); // 2 days padding
  if (nights.length === 0) throw new AppError('El rango de fechas es inválido', 400, 'INVALID_DATE_RANGE');

  const blocks = await AvailabilityBlock.findAll({
    where: {
      tenant_id,
      date: { [Op.in]: nights },
    },
  });

  // We want to find the minimum available_count across all nights for each room type
  const roomTypesMap = {};

  for (const block of blocks) {
    if (roomTypesMap[block.room_type_id] === undefined) {
      roomTypesMap[block.room_type_id] = block.available_count;
    } else {
      roomTypesMap[block.room_type_id] = Math.min(roomTypesMap[block.room_type_id], block.available_count);
    }
  }

  // Any room type that is NOT in the blocks means it hasn't been booked at all, 
  // so it has full availability. But we don't know the full availability here.
  // The frontend will combine this map with the roomTypes total_count.

  return {
    nights: _dateRange(check_in_date, check_out_date, 0).length,
    availability: roomTypesMap, // { room_type_id: min_available_count }
  };
}

/**
 * Decrement available_count for each night in a date range.
 * Called inside createReservation transaction.
 * Uses upsert so blocks are auto-initialized on first booking.
 */
async function blockDates(tenant_id, room_type_id, check_in_date, check_out_date, total_rooms, transaction) {
  const nights = _dateRange(check_in_date, check_out_date, 2); // 2 days padding

  for (const date of nights) {
    const [block] = await AvailabilityBlock.findOrCreate({
      where: { tenant_id, room_type_id, date },
      defaults: { tenant_id, room_type_id, date, total_count: total_rooms, available_count: total_rooms },
      transaction,
    });

    if (block.available_count <= 0) {
      throw new AppError(
        `Sin disponibilidad para la fecha ${date}`,
        409, 'NO_AVAILABILITY',
        { date, room_type_id }
      );
    }
    await block.decrement('available_count', { by: 1, transaction });
  }
}

/**
 * Increment available_count when a reservation is cancelled or modified.
 */
async function releaseDates(tenant_id, room_type_id, check_in_date, check_out_date, transaction) {
  const nights = _dateRange(check_in_date, check_out_date, 2); // 2 days padding

  await AvailabilityBlock.increment('available_count', {
    by: 1,
    where: { tenant_id, room_type_id, date: { [Op.in]: nights } },
    transaction,
  });
}

/**
 * Initialize or refresh availability blocks for a room type.
 * Called when a new room of this type is added to hotels-service.
 */
async function initializeBlocks(tenant_id, room_type_id, total_rooms, from_date, to_date) {
  const nights = _dateRange(from_date, to_date, 0); // No padding for initialization

  for (const date of nights) {
    await AvailabilityBlock.upsert({
      tenant_id, room_type_id, date,
      total_count:     total_rooms,
      available_count: total_rooms,
    });
  }
}

/**
 * Get physical rooms that have NO conflicting overlapping reservations for the requested dates.
 * Overlap condition:
 * A conflict happens if an existing reservation's checkout date + 2 days is > requested checkin
 * AND its checkin date < requested checkout.
 */
async function getFreePhysicalRooms(tenant_id, room_type_id, check_in_date, check_out_date, options = {}) {
  // 1. Get all physical rooms from hotels-service
  const { getPhysicalRooms } = require('./hotelsClient');
  const internalData = await getPhysicalRooms(tenant_id, room_type_id);
  
  if (!internalData || internalData.length === 0) return [];

  // 2. Query overlapping reservations in ReservationRoom
  const { ReservationRoom, Reservation, RESERVATION_STATUS } = require('../models');
  
  // Create Date objects to query manually
  // We need all reservations where:
  // check_in_date < RequestedOut AND DATE_ADD(check_out_date, 2) > RequestedIn
  // Using native sequelize logic:
  
  const where = {
    tenant_id,
    room_type_id,
    room_id: { [Op.ne]: null },
    [Op.and]: [
      { check_in_date: { [Op.lt]: check_out_date } },
      sequelize.literal(`"ReservationRoom"."check_out_date" + INTERVAL '2 days' > '${check_in_date}'`)
    ]
  };

  if (options.exclude_res_room_id) {
    where.id = { [Op.ne]: options.exclude_res_room_id };
  }

  const overlappingResRooms = await ReservationRoom.findAll({
    where,
    include: [{
      model: Reservation,
      as: 'reservation',
      where: {
        status: {
          [Op.notIn]: ['CANCELED', 'CHECKED_OUT']
        }
      }
    }]
  });

  const occupiedRoomIds = overlappingResRooms.map(r => r.room_id);
  
  // 3. Filter out
  const freeRooms = internalData.filter(pr => !occupiedRoomIds.includes(pr.id));
  
  return freeRooms;
}

module.exports = { checkAvailability, checkAllAvailability, blockDates, releaseDates, initializeBlocks, _dateRange, getFreePhysicalRooms };
