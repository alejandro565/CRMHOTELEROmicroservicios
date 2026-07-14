const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const GuestDocument = sequelize.define(
  'GuestDocument',
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    guest_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'guests', key: 'id' },
    },
    tenant_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    // URL to stored scan (S3, MinIO, etc.) — this service never stores files directly
    document_url: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    doc_type: {
      type: DataTypes.ENUM('CI', 'PASSPORT', 'FOREIGN_ID', 'OTHER'),
      allowNull: false,
    },
    expiry_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    uploaded_by_user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  },
  {
    tableName: 'guest_documents',
    timestamps: true,
    underscored: true,
  }
);

module.exports = GuestDocument;
