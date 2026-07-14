const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Manual exchange rate set daily by hotel management.
 * Rate is always relative to the hotel's base currency (BOB).
 * Example: { currency: 'USD', rate: 8.50 } means 1 USD = 8.50 BOB.
 */
const ExchangeRate = sequelize.define('ExchangeRate', {
  id:        { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  tenant_id: { type: DataTypes.UUID, allowNull: false },
  currency:  { type: DataTypes.STRING(3), allowNull: false }, // ISO 4217: "USD", "EUR"
  rate:      { type: DataTypes.DECIMAL(10, 4), allowNull: false, validate: { min: 0.0001 } },
  date:      { type: DataTypes.DATEONLY, allowNull: false },
  set_by_user_id: { type: DataTypes.UUID, allowNull: false },
}, {
  tableName: 'exchange_rates',
  timestamps: true,
  underscored: true,
  indexes: [{ unique: true, fields: ['tenant_id', 'currency', 'date'] }],
});

module.exports = ExchangeRate;
