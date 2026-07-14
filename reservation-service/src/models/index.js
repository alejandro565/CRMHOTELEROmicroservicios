const { Reservation, RESERVATION_STATUS, RESERVATION_SOURCE } = require('./Reservation');
const ReservationRoom  = require('./ReservationRoom');
const ReservationGuest = require('./ReservationGuest');
const { StayLoan, LOAN_STATUS } = require('./StayLoan');
const AvailabilityBlock = require('./AvailabilityBlock');

// Reservation → ReservationRoom (1-to-many)
Reservation.hasMany(ReservationRoom,  { foreignKey: 'reservation_id', as: 'rooms' });
ReservationRoom.belongsTo(Reservation, { foreignKey: 'reservation_id', as: 'reservation' });

// Reservation → ReservationGuest (1-to-many) - Unassigned pool
Reservation.hasMany(ReservationGuest, { foreignKey: 'reservation_id', as: 'guest_list' });
ReservationGuest.belongsTo(Reservation, { foreignKey: 'reservation_id', as: 'reservation' });

// ReservationRoom → ReservationGuest (1-to-many)
ReservationRoom.hasMany(ReservationGuest, { foreignKey: 'res_room_id', as: 'guests' });
ReservationGuest.belongsTo(ReservationRoom, { foreignKey: 'res_room_id', as: 'room' });

// ReservationRoom → StayLoan (1-to-many)
ReservationRoom.hasMany(StayLoan, { foreignKey: 'res_room_id', as: 'loans' });
StayLoan.belongsTo(ReservationRoom, { foreignKey: 'res_room_id', as: 'room' });

module.exports = {
  Reservation, RESERVATION_STATUS, RESERVATION_SOURCE,
  ReservationRoom,
  ReservationGuest,
  StayLoan, LOAN_STATUS,
  AvailabilityBlock,
};
