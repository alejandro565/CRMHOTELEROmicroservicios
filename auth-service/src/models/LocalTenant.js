const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TENANT_STATUS = {
  ACTIVE:    'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  INACTIVE:  'INACTIVE',
};

/**
 * Local mirror of the tenant record from saas-service.
 * Populated by setupInitialAdmin() and kept in sync via RabbitMQ events.
 * auth-service never reads from saas-service DB — it owns this copy.
 */
const LocalTenant = sequelize.define(
  'LocalTenant',
  {
    id: {
      // Same UUID as in saas-service tenants table
      type:      DataTypes.UUID,
      primaryKey: true,
    },
    // Hotel display name — set on provisioning, used in the hotel selector screen
    hotel_name: {
      type:      DataTypes.STRING(200),
      allowNull: true,
    },
    status: {
      type:         DataTypes.ENUM(...Object.values(TENANT_STATUS)),
      allowNull:    false,
      defaultValue: TENANT_STATUS.ACTIVE,
    },
    plan_name: {
      type:      DataTypes.STRING(100),
      allowNull: true,
    },
    // How many hotels the owner's plan allows (0 = unlimited)
    max_hotels: {
      type:         DataTypes.INTEGER,
      allowNull:    false,
      defaultValue: 1,
    },
    // Max rooms per individual hotel (0 = unlimited)
    max_rooms_per_hotel: {
      type:         DataTypes.INTEGER,
      allowNull:    false,
      defaultValue: 0,
    },
    // Stored as a plain array of slugs: ["CRM","BILLING","CHECKIN"]
    active_modules: {
      type:         DataTypes.ARRAY(DataTypes.STRING),
      allowNull:    false,
      defaultValue: [],
    },
  },
  {
    tableName:   'tenants',
    timestamps:  true,
    underscored: true,
  }
);

module.exports = { LocalTenant, TENANT_STATUS };
