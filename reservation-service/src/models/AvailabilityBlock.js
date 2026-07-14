const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * One row per (tenant_id, room_type_id, date).
 * available_count = total_physical_rooms_of_type - booked_for_date.
 * Updated atomically whenever a reservation is created, edited or cancelled.
 */
const AvailabilityBlock = sequelize.define(
  'AvailabilityBlock',
  {
    id:           { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    tenant_id:    { type: DataTypes.UUID, allowNull: false },
    room_type_id: { type: DataTypes.UUID, allowNull: false },
    date:         { type: DataTypes.DATEONLY, allowNull: false },
    available_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },
    // Total physical rooms of this type — populated from hotels-service on first use
    total_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: 'availability_blocks',
    timestamps: true,
    underscored: true,
    indexes: [
      { unique: true, fields: ['tenant_id', 'room_type_id', 'date'] },
      { fields: ['tenant_id', 'date'] },
    ],
  }
);

module.exports = AvailabilityBlock;
