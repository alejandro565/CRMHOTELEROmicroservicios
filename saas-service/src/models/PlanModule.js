const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Pure join table — no extra fields needed
const PlanModule = sequelize.define(
  'PlanModule',
  {
    plan_id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      references: { model: 'plans', key: 'id' },
    },
    module_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
      primaryKey: true,
      references: { model: 'system_modules', key: 'id' },
    },
  },
  {
    tableName: 'plan_modules',
    timestamps: false,
    underscored: true,
  }
);

module.exports = PlanModule;
