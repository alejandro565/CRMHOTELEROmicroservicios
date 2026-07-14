const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ReservationGuest = sequelize.define(
  'ReservationGuest',
  {
    id:             { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    reservation_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'reservations', key: 'id' } },
    res_room_id:    { type: DataTypes.UUID, allowNull: true, references: { model: 'reservation_rooms', key: 'id' } },
    tenant_id:      { type: DataTypes.UUID, allowNull: false },
    guest_id:       { type: DataTypes.UUID, allowNull: false },
    guest_name:     { type: DataTypes.STRING(200), allowNull: true },
    is_primary:     { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    id_verified:    { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    // Data captured via portal or front-desk (for police/migration reports)
    origin_country: { type: DataTypes.STRING(80), allowNull: true },
    origin_city:    { type: DataTypes.STRING(80), allowNull: true },
  },
  {
    tableName: 'reservation_guests',
    timestamps: true,
    underscored: true,
    indexes: [
      { unique: true, fields: ['res_room_id', 'guest_id'] },
      { fields: ['tenant_id', 'guest_id'] },
    ],
  }
);

module.exports = ReservationGuest;
