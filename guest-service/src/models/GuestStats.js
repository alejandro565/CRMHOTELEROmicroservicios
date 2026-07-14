const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const GuestStats = sequelize.define(
  'GuestStats',
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    guest_id: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      references: { model: 'guests', key: 'id' },
    },
    tenant_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    total_stays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },
    total_spent: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.00,
    },
    last_visit_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    current_loyalty_level_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'loyalty_levels', key: 'id' },
    },
  },
  {
    tableName: 'guest_stats',
    timestamps: true,
    underscored: true,
  }
);

module.exports = GuestStats;
