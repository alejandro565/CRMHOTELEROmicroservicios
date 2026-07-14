const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FOLIO_TYPE   = { MASTER: 'MASTER', INCIDENTAL: 'INCIDENTAL' };
const FOLIO_STATUS = { OPEN: 'OPEN', SETTLED: 'SETTLED', VOIDED: 'VOIDED' };

const Folio = sequelize.define('Folio', {
  id:             { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  tenant_id:      { type: DataTypes.UUID, allowNull: false },
  reservation_id: { type: DataTypes.UUID, allowNull: false },
  type:           { type: DataTypes.ENUM(...Object.values(FOLIO_TYPE)), allowNull: false },
  status:         { type: DataTypes.ENUM(...Object.values(FOLIO_STATUS)), allowNull: false, defaultValue: FOLIO_STATUS.OPEN },
  // Running balance: sum(charges) - sum(payments). Negative = credit, 0 = cleared.
  balance:        { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  notes:          { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'folios',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['tenant_id', 'reservation_id'] },
    { fields: ['tenant_id', 'status'] },
  ],
});

module.exports = { Folio, FOLIO_TYPE, FOLIO_STATUS };
