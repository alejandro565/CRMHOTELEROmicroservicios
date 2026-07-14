const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RESERVATION_STATUS = {
  CONFIRMED:   'CONFIRMED',
  PRE_CHECKIN: 'PRE_CHECKIN',
  IN_HOUSE:    'IN_HOUSE',
  CHECKED_OUT: 'CHECKED_OUT',
  CANCELED:    'CANCELED',
  NOSHOW:      'NOSHOW',
};

const RESERVATION_SOURCE = ['WALK_IN', 'WEB', 'PHONE', 'BOOKING', 'EXPEDIA', 'AGENCY', 'OTHER'];

const Reservation = sequelize.define(
  'Reservation',
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    tenant_id:      { type: DataTypes.UUID, allowNull: false },
    main_guest_id:  { type: DataTypes.UUID, allowNull: false },
    main_guest_name: { type: DataTypes.STRING(200), allowNull: true },
    status: {
      type: DataTypes.ENUM(...Object.values(RESERVATION_STATUS)),
      allowNull: false,
      defaultValue: RESERVATION_STATUS.CONFIRMED,
    },
    source: {
      type: DataTypes.ENUM(...RESERVATION_SOURCE),
      allowNull: false,
      defaultValue: 'WALK_IN',
    },
    total_price: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    // Discount fraction applied at creation time (snapshot from guest-service)
    discount_applied: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: false,
      defaultValue: 0,
    },
    pending_balance: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    // Opaque UUID token for the guest self-registration portal
    guest_portal_token: { type: DataTypes.STRING(255), allowNull: true, unique: true },
    portal_token_expires_at: { type: DataTypes.DATE, allowNull: true },
    actual_check_in_at: { type: DataTypes.DATE, allowNull: true },
    actual_check_out_at: { type: DataTypes.DATE, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    tableName: 'reservations',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['tenant_id', 'status'] },
      { fields: ['tenant_id', 'main_guest_id'] },
      { fields: ['guest_portal_token'], unique: true, where: { guest_portal_token: { [require('sequelize').Op.ne]: null } } },
    ],
  }
);

module.exports = { Reservation, RESERVATION_STATUS, RESERVATION_SOURCE };
