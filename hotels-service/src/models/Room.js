const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ROOM_STATUS = {
  CLEAN:       'CLEAN',
  DIRTY:       'DIRTY',
  MAINTENANCE: 'MAINTENANCE',
  OCCUPIED:    'OCCUPIED',
};

const Room = sequelize.define(
  'Room',
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
    room_type_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'room_types', key: 'id' },
    },
    number: {
      // "101", "202A" — string to support alphanumeric numbering
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    floor: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 0 },
    },
    status: {
      type: DataTypes.ENUM(...Object.values(ROOM_STATUS)),
      allowNull: false,
      defaultValue: ROOM_STATUS.CLEAN,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: 'rooms',
    timestamps: true,
    underscored: true,
    indexes: [
      // Room number must be unique per tenant
      { unique: true, fields: ['tenant_id', 'number'] },
    ],
  }
);

module.exports = { Room, ROOM_STATUS };
