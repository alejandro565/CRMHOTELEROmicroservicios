const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Invoice = sequelize.define('Invoice', {
  id:           { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  folio_id:     { type: DataTypes.UUID, allowNull: false, references: { model: 'folios', key: 'id' } },
  tenant_id:    { type: DataTypes.UUID, allowNull: false },
  // Recipient details (entered freely by front-desk per Bolivian SIN rules)
  nit_ci:       { type: DataTypes.STRING(20), allowNull: false },
  razon_social: { type: DataTypes.STRING(300), allowNull: false },
  email:        { type: DataTypes.STRING(255), allowNull: true },
  total_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  // SIN integration fields (Bolivian tax authority)
  cuf:          { type: DataTypes.STRING(100), allowNull: true },  // Código Único de Factura
  xml_url:      { type: DataTypes.STRING(500), allowNull: true },  // SIN XML document URL
  sin_status:   { type: DataTypes.ENUM('PENDING', 'ACCEPTED', 'REJECTED'), allowNull: false, defaultValue: 'PENDING' },
}, {
  tableName: 'invoices',
  timestamps: true,
  underscored: true,
  indexes: [{ fields: ['folio_id'] }, { fields: ['tenant_id', 'nit_ci'] }],
});

module.exports = Invoice;
