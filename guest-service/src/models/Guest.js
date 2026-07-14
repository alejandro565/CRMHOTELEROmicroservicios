const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DOC_TYPES = ['CI', 'PASSPORT', 'FOREIGN_ID', 'OTHER'];

const CIVIL_STATUS = ['Soltero', 'Casado', 'Divorciado', 'Viudo', 'Unión Libre'];

const Guest = sequelize.define(
  'Guest',
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
    first_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    last_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    doc_type: {
      type: DataTypes.ENUM(...DOC_TYPES),
      allowNull: false,
      defaultValue: 'CI',
    },
    doc_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: { isEmail: true },
    },
    phone: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    nationality: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    gender: {
      type: DataTypes.ENUM('M', 'F', 'OTHER'),
      allowNull: true,
    },
    birth_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    civil_status: {
      // Kept as string to support localisation — Bolivian police reports need Spanish values
      type: DataTypes.ENUM(...CIVIL_STATUS),
      allowNull: true,
    },
    // Optional link to company (corporate guest)
    company_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Soft-merged flag: when mergeGuests() is called the duplicate is marked here
    merged_into_id: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    tableName: 'guests',
    timestamps: true,
    underscored: true,
    hooks: {
      beforeValidate: (guest) => {
        const fieldsToNormalize = ['email', 'phone', 'nationality', 'birth_date'];
        fieldsToNormalize.forEach(field => {
          if (guest[field] === '') {
            guest[field] = null;
          }
        });
      }
    },
    indexes: [
      // Fast lookup during reservation: doc must be unique per tenant
      { unique: true, fields: ['tenant_id', 'doc_type', 'doc_number'] },
      { fields: ['tenant_id', 'email'] },
    ],
  }
);

module.exports = { Guest, DOC_TYPES, CIVIL_STATUS };
