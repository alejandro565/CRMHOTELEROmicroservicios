const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Permission = sequelize.define(
  'Permission',
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    module: {
      // e.g. "RESERVATIONS", "BILLING", "CRM"
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    slug: {
      // e.g. "RESERVATIONS_CREATE" — unique, uppercase, machine-readable
      type: DataTypes.STRING(80),
      allowNull: false,
      unique: true,
      validate: { is: /^[A-Z0-9_]+$/ },
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    tableName: 'permissions',
    timestamps: true,
    underscored: true,
  }
);

module.exports = Permission;
