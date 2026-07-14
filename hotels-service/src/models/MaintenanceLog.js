const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const INCIDENT_STATUS = {
  OPEN:     'OPEN',
  RESOLVED: 'RESOLVED',
};

// ─── Open incidents (blocks the room) ────────────────────────────────────────

const RoomIncidentLog = sequelize.define(
  'RoomIncidentLog',
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
    room_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'rooms', key: 'id' },
    },
    // Optional: which lendable item was damaged
    item_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'lendable_items', key: 'id' },
    },
    // Optional: link to reservation for billing charge
    reservation_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    reported_by_user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(INCIDENT_STATUS)),
      allowNull: false,
      defaultValue: INCIDENT_STATUS.OPEN,
    },
  },
  {
    tableName: 'room_incident_logs',
    timestamps: true,
    underscored: true,
  }
);

// ─── Historical maintenance records ──────────────────────────────────────────

const MaintenanceLog = sequelize.define(
  'MaintenanceLog',
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
    incident_id: {
      // Reference to the resolved RoomIncidentLog
      type: DataTypes.UUID,
      allowNull: false,
    },
    room_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    resolved_by_user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    repair_notes: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    repair_cost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
    },
    resolved_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'maintenance_logs',
    timestamps: true,
    underscored: true,
  }
);

module.exports = { RoomIncidentLog, MaintenanceLog, INCIDENT_STATUS };
