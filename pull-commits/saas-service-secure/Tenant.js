const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TENANT_STATUS = {
  ACTIVE:    'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  INACTIVE:  'INACTIVE',
};

const Tenant = sequelize.define(
  'Tenant',
  {
    id: {
      type:         DataTypes.UUID,
      primaryKey:   true,
      defaultValue: DataTypes.UUIDV4,
    },
    plan_id: {
      type:      DataTypes.UUID,
      allowNull: false,
      references: { model: 'plans', key: 'id' },
    },
    // UUID of the Owner user in auth-service.
    // Set on first hotel creation and used to validate all subsequent hotels.
    // Replaces the fragile owner_email-based lookup.
    owner_id: {
      type:      DataTypes.UUID,
      allowNull: false,
    },
    name: {
      type:      DataTypes.STRING(200),
      allowNull: false,
    },
    tax_id: {
      type:      DataTypes.STRING(30),
      allowNull: false,
      unique:    true,
    },
    owner_email: {
      type:      DataTypes.STRING(255),
      allowNull: false,
      validate:  { isEmail: true },
    },
    status: {
      type:         DataTypes.ENUM(...Object.values(TENANT_STATUS)),
      allowNull:    false,
      defaultValue: TENANT_STATUS.ACTIVE,
    },
    deleted_at: {
      type:         DataTypes.DATE,
      allowNull:    true,
      defaultValue: null,
    },
  },
  {
    tableName:   'tenants',
    timestamps:  true,
    underscored: true,
    indexes: [
      { fields: ['owner_id'] },
      { fields: ['owner_id', 'status'] },
    ],
  }
);

module.exports = { Tenant, TENANT_STATUS };
