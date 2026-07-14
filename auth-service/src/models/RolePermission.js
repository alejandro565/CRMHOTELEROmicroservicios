const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RolePermission = sequelize.define(
  'RolePermission',
  {
    role_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'roles', key: 'id' },
    },
    permission_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'permissions', key: 'id' },
    },
  },
  {
    tableName: 'role_permissions',
    timestamps: false,
    underscored: true,
  }
);

module.exports = RolePermission;
