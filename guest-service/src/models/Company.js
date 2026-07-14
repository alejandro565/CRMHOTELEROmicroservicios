const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Company = sequelize.define(
  'Company',
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
    business_name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    tax_id: {
      // NIT of the corporate client
      type: DataTypes.STRING(30),
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
    contact_name: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    // Negotiated discount fraction: 0.15 = 15% off for all guests linked to this company
    corporate_discount: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: false,
      defaultValue: 0.0000,
      validate: { min: 0, max: 1 },
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: 'companies',
    timestamps: true,
    underscored: true,
    hooks: {
      beforeValidate: (company) => {
        const fieldsToNormalize = ['email', 'phone', 'contact_name'];
        fieldsToNormalize.forEach(field => {
          if (company[field] === '') {
            company[field] = null;
          }
        });
      }
    },
    indexes: [
      { unique: true, fields: ['tenant_id', 'tax_id'] },
    ],
  }
);

module.exports = Company;
