const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PAYMENT_METHOD = ['CASH', 'QR_PAY', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'OTHER'];

const Payment = sequelize.define('Payment', {
  id:        { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  folio_id:  { type: DataTypes.UUID, allowNull: false, references: { model: 'folios', key: 'id' } },
  shift_id:  { type: DataTypes.UUID, allowNull: true,  references: { model: 'cashier_shifts', key: 'id' } },
  tenant_id: { type: DataTypes.UUID, allowNull: false },
  method:    { type: DataTypes.ENUM(...PAYMENT_METHOD), allowNull: false },
  // Always stored in the hotel's base currency (BOB) regardless of received_currency
  amount_base: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  // What the guest physically handed over
  received_currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'BOB' },
  received_amount:   { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  // Rate frozen at transaction time (1.0 when currency = base)
  exchange_rate_used: { type: DataTypes.DECIMAL(10, 4), allowNull: false, defaultValue: 1.0 },
  // Soft void
  is_voided:         { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  voided_by_user_id: { type: DataTypes.UUID, allowNull: true },
  void_reason:       { type: DataTypes.STRING(255), allowNull: true },
  notes:             { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'payments',
  timestamps: true,
  underscored: true,
  indexes: [{ fields: ['folio_id'] }, { fields: ['shift_id'] }, { fields: ['tenant_id', 'method'] }],
});

module.exports = { Payment, PAYMENT_METHOD };
