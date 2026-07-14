const { Guest, DOC_TYPES, CIVIL_STATUS } = require('./Guest');
const LoyaltyLevel  = require('./LoyaltyLevel');
const GuestStats    = require('./GuestStats');
const Company       = require('./Company');
const GuestDocument = require('./GuestDocument');

// Guest → Company (optional corporate link)
Guest.belongsTo(Company,  { foreignKey: 'company_id', as: 'company' });
Company.hasMany(Guest,    { foreignKey: 'company_id', as: 'guests' });

// GuestStats → Guest (1-to-1)
GuestStats.belongsTo(Guest,        { foreignKey: 'guest_id', as: 'guest' });
GuestStats.belongsTo(LoyaltyLevel, { foreignKey: 'current_loyalty_level_id', as: 'loyalty_level' });
Guest.hasOne(GuestStats,           { foreignKey: 'guest_id', as: 'stats' });

// GuestDocument → Guest (1-to-many)
GuestDocument.belongsTo(Guest, { foreignKey: 'guest_id', as: 'guest' });
Guest.hasMany(GuestDocument,   { foreignKey: 'guest_id', as: 'documents' });

module.exports = { Guest, DOC_TYPES, CIVIL_STATUS, LoyaltyLevel, GuestStats, Company, GuestDocument };
