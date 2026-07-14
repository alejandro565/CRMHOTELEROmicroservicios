const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// ─── Catalog ──────────────────────────────────────────────────────────────────

const LendableItem = sequelize.define(
  'LendableItem',
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
      // "Manta", "Control Aire Acondicionado", "Adaptador HDMI"
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    replacement_cost: {
      // Amount charged to guest if item is lost/damaged
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },
  },
  {
    tableName: 'lendable_items',
    timestamps: true,
    underscored: true,
    indexes: [{ unique: true, fields: ['tenant_id', 'name'] }],
  }
);

// ─── Stock ────────────────────────────────────────────────────────────────────

const ItemInventory = sequelize.define(
  'ItemInventory',
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
    item_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'lendable_items', key: 'id' },
    },
    total_qty: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },
    available_qty: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },
    damaged_qty: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },
    // Threshold for INVENTORY_LOW_ALERT event
    low_stock_threshold: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 3,
    },
  },
  {
    tableName: 'item_inventory',
    timestamps: true,
    underscored: true,
    indexes: [{ unique: true, fields: ['tenant_id', 'item_id'] }],
  }
);

module.exports = { LendableItem, ItemInventory };
