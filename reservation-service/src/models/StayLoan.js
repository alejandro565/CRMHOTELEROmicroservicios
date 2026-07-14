const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const LOAN_STATUS = { LENT: 'LENT', RETURNED: 'RETURNED', LOST: 'LOST' };

const StayLoan = sequelize.define(
  'StayLoan',
  {
    id:          { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    res_room_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'reservation_rooms', key: 'id' } },
    tenant_id:   { type: DataTypes.UUID, allowNull: false },
    // item_id references hotels-service lendable_items (cross-service FK — not enforced in DB)
    item_id:     { type: DataTypes.UUID, allowNull: false },
    item_name:   { type: DataTypes.STRING(120), allowNull: false }, // snapshot to avoid cross-service joins
    quantity:    { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, validate: { min: 1 } },
    status: {
      type: DataTypes.ENUM(...Object.values(LOAN_STATUS)),
      allowNull: false,
      defaultValue: LOAN_STATUS.LENT,
    },
    lent_by_user_id:     { type: DataTypes.UUID, allowNull: false },
    returned_by_user_id: { type: DataTypes.UUID, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    replacement_cost: {
      // Snapshot of the item's replacement_cost at lending time
      // Used to auto-charge the guest if item is marked as LOST
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: 'stay_loans',
    timestamps: true,
    underscored: true,
    indexes: [{ fields: ['res_room_id', 'status'] }, { fields: ['tenant_id', 'item_id'] }],
  }
);

module.exports = { StayLoan, LOAN_STATUS };
