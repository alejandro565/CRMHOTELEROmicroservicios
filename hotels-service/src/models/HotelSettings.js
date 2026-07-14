const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const HotelSettings = sequelize.define(
  'HotelSettings',
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    tenant_id: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,   // one settings row per hotel
    },
    timezone: {
      type: DataTypes.STRING(60),
      allowNull: false,
      defaultValue: 'America/La_Paz',
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'BOB',
    },
    checkin_time: {
      type: DataTypes.STRING(5),   // "14:00"
      allowNull: false,
      defaultValue: '14:00',
    },
    checkout_time: {
      type: DataTypes.STRING(5),   // "12:00"
      allowNull: false,
      defaultValue: '12:00',
    },
    // Max rooms allowed by the plan — synced from TENANT_PROVISIONED event
    plan_max_rooms: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,   // 0 = unlimited
    },
  },
  {
    tableName: 'hotel_settings',
    timestamps: true,
    underscored: true,
  }
);

module.exports = HotelSettings;
