const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { CHARGE_CATEGORIES } = require('./FolioRoutingRule');

const Charge = sequelize.define('Charge', {
  id:          { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  folio_id:    { type: DataTypes.UUID, allowNull: false, references: { model: 'folios', key: 'id' } },
  tenant_id:   { type: DataTypes.UUID, allowNull: false },
  category:    { type: DataTypes.ENUM(...CHARGE_CATEGORIES), allowNull: false, defaultValue: 'OTHER' },
  // Positive = debt, negative = discount/commercial adjustment (regateo)
  amount:      { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  description: { type: DataTypes.STRING(500), allowNull: false },
  // Soft void — keeps the audit trail
  is_voided:   { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  voided_by_user_id: { type: DataTypes.UUID, allowNull: true },
  void_reason: { type: DataTypes.STRING(255), allowNull: true },
  // Optional link to a source event (reservation, item damage, etc.)
  source_ref:  { type: DataTypes.STRING(100), allowNull: true },
}, {
  tableName: 'charges',
  timestamps: true,
  underscored: true,
  indexes: [{ fields: ['folio_id'] }, { fields: ['tenant_id', 'category'] }],
});

module.exports = Charge;
