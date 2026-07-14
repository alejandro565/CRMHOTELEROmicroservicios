const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const BedType = sequelize.define(
  'BedType',
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
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(250),
      allowNull: true,
    },
  },
  {
    tableName: 'bed_types',
    timestamps: true,
    underscored: true,
    indexes: [
      { unique: true, fields: ['tenant_id', 'name'] },
    ],
  }
);

module.exports = BedType;
