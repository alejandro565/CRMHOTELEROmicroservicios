const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Routing rules determine which folio receives charges of a given category.
 * Example: move "ACCOMMODATION" from the incidental folio to the master folio
 * so the company pays lodging and the guest pays personal expenses.
 */
const CHARGE_CATEGORIES = [
  'ACCOMMODATION', 'FOOD_BEVERAGE', 'LAUNDRY', 'SPA',
  'MINIBAR', 'PARKING', 'TELEPHONE', 'DAMAGE', 'OTHER',
];

const FolioRoutingRule = sequelize.define('FolioRoutingRule', {
  id:               { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  tenant_id:        { type: DataTypes.UUID, allowNull: false },
  source_folio_id:  { type: DataTypes.UUID, allowNull: false, references: { model: 'folios', key: 'id' } },
  target_folio_id:  { type: DataTypes.UUID, allowNull: false, references: { model: 'folios', key: 'id' } },
  // Which charge category is auto-routed to the target folio
  category_to_move: { type: DataTypes.ENUM(...CHARGE_CATEGORIES), allowNull: false },
}, {
  tableName: 'folio_routing_rules',
  timestamps: true,
  underscored: true,
  indexes: [{ unique: true, fields: ['source_folio_id', 'category_to_move'] }],
});

module.exports = { FolioRoutingRule, CHARGE_CATEGORIES };
