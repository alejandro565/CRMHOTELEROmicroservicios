const { DataTypes } = require('sequelize');
const Plan = require('./Plan');
const SystemModule = require('./SystemModule');
const PlanModule = require('./PlanModule');
const { Tenant, TENANT_STATUS } = require('./Tenant');

// Plan ↔ SystemModule  (many-to-many through plan_modules)
// otherKey needs explicit type because SystemModule.id is STRING (slug), not UUID.
// Without this Sequelize generates a type-mismatched JOIN in Postgres.
Plan.belongsToMany(SystemModule, {
  through: PlanModule,
  foreignKey: {
    name: 'plan_id',
    type: DataTypes.UUID,
  },
  otherKey: {
    name: 'module_id',
    type: DataTypes.STRING(50),
  },
  as: 'modules',
});
SystemModule.belongsToMany(Plan, {
  through: PlanModule,
  foreignKey: {
    name: 'module_id',
    type: DataTypes.STRING(50),
  },
  otherKey: {
    name: 'plan_id',
    type: DataTypes.UUID,
  },
  as: 'plans',
});

// Tenant → Plan  (many-to-one)
Tenant.belongsTo(Plan, { foreignKey: 'plan_id', as: 'plan' });
Plan.hasMany(Tenant, { foreignKey: 'plan_id', as: 'tenants' });

module.exports = { Plan, SystemModule, PlanModule, Tenant, TENANT_STATUS };