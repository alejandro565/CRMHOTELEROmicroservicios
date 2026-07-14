const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const LoyaltyLevel = sequelize.define(
  'LoyaltyLevel',
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
      // "Normal", "Bronce", "Plata", "Oro"
      type: DataTypes.STRING(80),
      allowNull: false,
    },
    // Minimum total stays to qualify for this level
    min_stays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },
    // Fraction applied at checkout: 0.10 = 10% off
    discount_percentage: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: false,
      defaultValue: 0.0000,
      validate: { min: 0, max: 1 },
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    // System flag: "Normal" level seeded on TENANT_PROVISIONED cannot be deleted
    is_default: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: 'loyalty_levels',
    timestamps: true,
    underscored: true,
    indexes: [
      { unique: true, fields: ['tenant_id', 'name'] },
    ],
  }
);

module.exports = LoyaltyLevel;
