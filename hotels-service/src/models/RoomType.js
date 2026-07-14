const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RoomType = sequelize.define(
  'RoomType',
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    tenant_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    name: {
      // "Habitación Simple", "Suite", "Doble"
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    max_capacity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 2,
      validate: { min: 1 },
    },
    base_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: { min: 0 },
    },
    bathroom_type: {
      type: DataTypes.ENUM('PRIVATE', 'SHARED', 'NONE'),
      allowNull: false,
      defaultValue: 'PRIVATE',
    },
  },
  {
    tableName: 'room_types',
    timestamps: true,
    underscored: true,
    indexes: [
      // Name must be unique per tenant
      { unique: true, fields: ['tenant_id', 'name'] },
    ],
  }
);

module.exports = RoomType;
