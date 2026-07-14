const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * UserTenant — vincula un usuario con múltiples hoteles.
 *
 * Un gerente puede gestionar varios hoteles con el mismo email.
 * Cada fila define qué rol tiene ese usuario EN ESE hotel específico,
 * permitiendo que sea TENANT_ADMIN en uno y RECEPTIONIST en otro.
 *
 * Flujo:
 *   1. Login     → devuelve la lista de hoteles de este usuario
 *   2. Si > 1    → frontend muestra pantalla de selección
 *   3. /switch-tenant → emite JWT con el tenant_id elegido
 */
const UserTenant = sequelize.define('UserTenant', {
  id: {
    type:         DataTypes.UUID,
    primaryKey:   true,
    defaultValue: DataTypes.UUIDV4,
  },
  user_id: {
    type:      DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
  },
  tenant_id: {
    type:      DataTypes.UUID,
    allowNull: false,
    references: { model: 'tenants', key: 'id' },
  },
  role_id: {
    type:      DataTypes.UUID,
    allowNull: false,
    references: { model: 'roles', key: 'id' },
  },
  is_active: {
    type:         DataTypes.BOOLEAN,
    allowNull:    false,
    defaultValue: true,
  },
  work_schedule: {
    type:         DataTypes.STRING(255),
    allowNull:    true,
    defaultValue: null,
  },
}, {
  tableName: 'user_tenants',
  timestamps: true,
  underscored: true,
  indexes: [
    // Un usuario solo puede tener un registro por tenant
    { unique: true, fields: ['user_id', 'tenant_id'] },
    { fields: ['user_id'] },
    { fields: ['tenant_id'] },
  ],
});

module.exports = UserTenant;
