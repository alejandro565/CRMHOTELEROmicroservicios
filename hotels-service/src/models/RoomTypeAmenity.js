const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RoomTypeAmenity = sequelize.define(
  'RoomTypeAmenity',
  {
    room_type_id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
    },
    amenity_id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
    },
  },
  {
    tableName: 'room_type_amenities',
    timestamps: false,
    underscored: true,
  }
);

module.exports = RoomTypeAmenity;
