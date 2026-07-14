const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Daily occupancy projection — one row per (tenant, date)
const DailyOccupancyStats = sequelize.define('DailyOccupancyStats', {
  id:                   { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  tenant_id:            { type: DataTypes.UUID, allowNull: false },
  date:                 { type: DataTypes.DATEONLY, allowNull: false },
  total_rooms:          { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  occupied_rooms:       { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  occupancy_percentage: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
}, {
  tableName: 'daily_occupancy_stats',
  timestamps: true, underscored: true,
  indexes: [{ unique: true, fields: ['tenant_id', 'date'] }],
});

// Revenue projection — one row per (tenant, date, category)
const RevenueStats = sequelize.define('RevenueStats', {
  id:            { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  tenant_id:     { type: DataTypes.UUID, allowNull: false },
  date:          { type: DataTypes.DATEONLY, allowNull: false },
  total_revenue: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  adr:           { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  revpar:        { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  // Category breakdown: ROOM, FOOD_BEVERAGE, EXTRAS, DAMAGE, etc.
  category:      { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'ROOM' },
}, {
  tableName: 'revenue_stats',
  timestamps: true, underscored: true,
  indexes: [{ unique: true, fields: ['tenant_id', 'date', 'category'] }],
});

// Shift report snapshot — written on SHIFT_CLOSED event
const ShiftReport = sequelize.define('ShiftReport', {
  id:             { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  tenant_id:      { type: DataTypes.UUID, allowNull: false },
  shift_id:       { type: DataTypes.UUID, allowNull: false, unique: true },
  user_id:        { type: DataTypes.UUID, allowNull: false },
  expected_cash:  { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  actual_cash:    { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  difference:     { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  // Full breakdown by method/currency stored as JSONB for flexible reporting
  totals_snapshot:{ type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  closed_at:      { type: DataTypes.DATE, allowNull: false },
}, {
  tableName: 'shift_reports',
  timestamps: true, underscored: true,
  indexes: [{ fields: ['tenant_id', 'closed_at'] }],
});

module.exports = { DailyOccupancyStats, RevenueStats, ShiftReport };
