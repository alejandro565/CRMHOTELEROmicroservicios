const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RoomTypeBed = sequelize.define(
  'RoomTypeBed',
  {
    room_type_id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
    },
    bed_type_id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
    },
    count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: { min: 1 },
    },
  },
  {
    tableName: 'room_type_beds',
    timestamps: false,
    underscored: true,
  }
);

module.exports = RoomTypeBed;
