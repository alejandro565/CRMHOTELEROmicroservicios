const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ReservationRoom = sequelize.define(
  'ReservationRoom',
  {
    id:             { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    reservation_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'reservations', key: 'id' } },
    tenant_id:      { type: DataTypes.UUID, allowNull: false },
    // Type booked (from hotels-service catalog)
    room_type_id:   { type: DataTypes.UUID, allowNull: false },
    room_type_name: { type: DataTypes.STRING(100), allowNull: false }, // snapshot
    // Physical room assigned (null until assignPhysicalRoom is called)
    room_id:        { type: DataTypes.UUID, allowNull: true, defaultValue: null },
    room_number:    { type: DataTypes.STRING(10), allowNull: true },   // snapshot
    check_in_date:  { type: DataTypes.DATEONLY, allowNull: false },
    check_out_date: { type: DataTypes.DATEONLY, allowNull: false },
    // Price frozen at booking time — immune to future rate changes
    rate_per_night: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    adults:         { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, validate: { min: 1 } },
    children:       { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, validate: { min: 0 } },
  },
  {
    tableName: 'reservation_rooms',
    timestamps: true,
    underscored: true,
    indexes: [{ fields: ['reservation_id'] }, { fields: ['tenant_id', 'room_id'] }],
  }
);

module.exports = ReservationRoom;
