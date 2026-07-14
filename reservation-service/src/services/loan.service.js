const { StayLoan, ReservationRoom, Reservation, LOAN_STATUS, RESERVATION_STATUS } = require('../models');
const AppError = require('../middlewares/AppError');
const { adjustInventory, getItemDetails } = require('./hotelsClient');
const { addLostItemCharge } = require('./billingClient');

async function lendItem({ res_room_id, tenant_id, item_id, item_name, quantity, lent_by_user_id, notes }) {
  const resRoom = await ReservationRoom.findOne({
    where: { id: res_room_id, tenant_id },
    include: [{ model: Reservation, as: 'reservation' }],
  });
  if (!resRoom) throw new AppError('Habitación de reserva no encontrada', 404, 'RES_ROOM_NOT_FOUND');

  // Allow lending during reception process (PRE_CHECKIN) or stay (IN_HOUSE)
  if (![RESERVATION_STATUS.IN_HOUSE, RESERVATION_STATUS.PRE_CHECKIN].includes(resRoom.reservation.status)) {
    throw new AppError('Solo se pueden prestar objetos a huéspedes en estancia (IN_HOUSE o PRE_CHECKIN)', 409, 'INVALID_STATUS');
  }

  // Prevent multiple keys of same type for same room (if item_name includes 'llave')
  if (item_name.toLowerCase().includes('llave')) {
    const existing = await StayLoan.findOne({ 
      where: { res_room_id, item_id, status: LOAN_STATUS.LENT, tenant_id } 
    });
    if (existing) throw new AppError('Esta habitación ya tiene una llave asignada', 409, 'KEY_ALREADY_LENT');
  }

  // Snapshot the replacement_cost from hotels-service at lending time
  // This ensures the charge amount is fixed even if the catalog price changes later
  let replacement_cost = 0;
  const itemDetails = await getItemDetails(item_id, tenant_id);
  if (itemDetails?.replacement_cost) {
    replacement_cost = parseFloat(itemDetails.replacement_cost) * quantity;
  }

  const loan = await StayLoan.create({
    res_room_id, tenant_id, item_id, item_name, quantity,
    status: LOAN_STATUS.LENT, lent_by_user_id, notes,
    replacement_cost,
  });
  
  // Update inventory in hotels-service (async)
  adjustInventory(item_id, tenant_id, -quantity, 'LENT');

  return loan;
}

async function returnItem(loan_id, tenant_id, returned_by_user_id) {
  const loan = await StayLoan.findOne({ where: { id: loan_id, tenant_id } });
  if (!loan) throw new AppError('Préstamo no encontrado', 404, 'LOAN_NOT_FOUND');
  if (loan.status !== LOAN_STATUS.LENT) {
    throw new AppError(`El préstamo ya tiene estado ${loan.status}`, 409, 'LOAN_ALREADY_RESOLVED');
  }
  await loan.update({ status: LOAN_STATUS.RETURNED, returned_by_user_id });
  
  // Return to inventory
  adjustInventory(loan.item_id, tenant_id, loan.quantity, 'RETURNED');
  
  return loan;
}

async function markLost(loan_id, tenant_id, returned_by_user_id) {
  const loan = await StayLoan.findOne({
    where: { id: loan_id, tenant_id },
    include: [{ 
      model: ReservationRoom, 
      as: 'room',
      include: [{ model: Reservation, as: 'reservation' }]
    }],
  });
  if (!loan) throw new AppError('Préstamo no encontrado', 404, 'LOAN_NOT_FOUND');
  if (loan.status !== LOAN_STATUS.LENT) {
    throw new AppError(`El préstamo ya tiene estado ${loan.status}`, 409, 'LOAN_ALREADY_RESOLVED');
  }

  await loan.update({ status: LOAN_STATUS.LOST, returned_by_user_id });

  // Auto-charge the guest for the lost item if a replacement cost was recorded
  const chargeAmount = parseFloat(loan.replacement_cost || 0);
  if (chargeAmount > 0 && loan.room?.reservation) {
    const reservation = loan.room.reservation;
    addLostItemCharge({
      reservation_id: reservation.id,
      tenant_id,
      item_name: loan.item_name,
      amount: chargeAmount,
    });
  } else if (chargeAmount > 0) {
    // Fallback: look up reservation through res_room_id directly
    const resRoom = await ReservationRoom.findOne({
      where: { id: loan.res_room_id, tenant_id },
      include: [{ model: Reservation, as: 'reservation' }],
    });
    if (resRoom?.reservation) {
      addLostItemCharge({
        reservation_id: resRoom.reservation.id,
        tenant_id,
        item_name: loan.item_name,
        amount: chargeAmount,
      });
    }
  }
  
  // Do NOT return to inventory (it is lost)
  
  return loan;
}

async function listLoans(tenant_id, res_room_id, { status } = {}) {
  const where = { tenant_id, res_room_id };
  if (status) where.status = status;
  return StayLoan.findAll({ where, order: [['created_at', 'DESC']] });
}

module.exports = { lendItem, returnItem, markLost, listLoans };
