const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SystemModule = sequelize.define(
  'SystemModule',
  {
    id: {
      // Slug-style PK: "CRM", "BILLING", "HOUSEKEEPING"
      type: DataTypes.STRING(50),
      primaryKey: true,
      allowNull: false,
      validate: {
        is: /^[A-Z0-9_]+$/,  // uppercase slug only
        notEmpty: true,
      },
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: 'system_modules',
    timestamps: true,
    underscored: true,
  }
);

module.exports = SystemModule;
