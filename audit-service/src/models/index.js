const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AUDIT_ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'VOID'];

const AUDIT_MODULES = [
  'RESERVATIONS', 'BILLING', 'GUESTS', 'HOTELS',
  'USERS', 'ROLES', 'SAAS', 'AUTH',
];

const ActivityLog = sequelize.define('ActivityLog', {
  id:         { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  tenant_id:  { type: DataTypes.UUID, allowNull: true },  // null for super-admin actions
  user_id:    { type: DataTypes.UUID, allowNull: true },
  action:     { type: DataTypes.ENUM(...AUDIT_ACTIONS), allowNull: false },
  module:     { type: DataTypes.ENUM(...AUDIT_MODULES), allowNull: false },
  entity_id:  { type: DataTypes.STRING(255), allowNull: true },
  ip_address: { type: DataTypes.STRING(45),  allowNull: true },
  user_agent: { type: DataTypes.TEXT,        allowNull: true },
  // Snapshot of the relevant context at log time
  meta:       { type: DataTypes.JSONB,       allowNull: true, defaultValue: {} },
  occurred_at:{ type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: 'activity_logs',
  // NO updatedAt — immutable by design
  createdAt: 'occurred_at',
  updatedAt: false,
  indexes: [
    { fields: ['tenant_id', 'module', 'action'] },
    { fields: ['tenant_id', 'entity_id'] },
    { fields: ['tenant_id', 'user_id'] },
    { fields: ['occurred_at'] },
  ],
});

const DataDiff = sequelize.define('DataDiff', {
  id:             { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  log_id:         { type: DataTypes.UUID, allowNull: false, references: { model: 'activity_logs', key: 'id' } },
  // JSONB columns allow field-level queries: e.g. previous_state->>'price' = '500'
  previous_state: { type: DataTypes.JSONB, allowNull: true },
  new_state:      { type: DataTypes.JSONB, allowNull: true },
}, {
  tableName: 'data_diffs',
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [{ fields: ['log_id'] }],
});

// DataDiff → ActivityLog
DataDiff.belongsTo(ActivityLog, { foreignKey: 'log_id', as: 'log' });
ActivityLog.hasOne(DataDiff,    { foreignKey: 'log_id', as: 'diff' });

module.exports = { ActivityLog, DataDiff, AUDIT_ACTIONS, AUDIT_MODULES };
