const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Role = sequelize.define(
  'Role',
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    tenant_id: {
      // NULL for global system roles (TENANT_ADMIN, RECEPTIONIST, etc.)
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    is_system_role: {
      // System roles cannot be edited or deleted by tenants
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: 'roles',
    timestamps: true,
    underscored: true,
    indexes: [
      // A tenant can't have two roles with the same name
      { unique: true, fields: ['tenant_id', 'name'] },
    ],
  }
);

module.exports = Role;
