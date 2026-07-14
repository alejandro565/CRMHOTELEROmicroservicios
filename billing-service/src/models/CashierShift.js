const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SHIFT_STATUS = { OPEN: 'OPEN', CLOSED: 'CLOSED' };

const CashierShift = sequelize.define('CashierShift', {
  id:            { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  tenant_id:     { type: DataTypes.UUID, allowNull: false },
  user_id:       { type: DataTypes.UUID, allowNull: false },
  status:        { type: DataTypes.ENUM(...Object.values(SHIFT_STATUS)), allowNull: false, defaultValue: SHIFT_STATUS.OPEN },
  starting_cash: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  // Calculated at closeShift from all payments in the shift
  expected_cash: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
  // What the cashier physically counts
  actual_cash:   { type: DataTypes.DECIMAL(12, 2), allowNull: true },
  // expected - actual (negative = overage, positive = shortage)
  difference:    { type: DataTypes.DECIMAL(12, 2), allowNull: true },
  opened_at:     { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  closed_at:     { type: DataTypes.DATE, allowNull: true },
  notes:         { type: DataTypes.TEXT, allowNull: true },
}, { tableName: 'cashier_shifts', timestamps: true, underscored: true });

module.exports = { CashierShift, SHIFT_STATUS };
