const { CashierShift, SHIFT_STATUS }           = require('./CashierShift');
const ExchangeRate                             = require('./ExchangeRate');
const { Folio, FOLIO_TYPE, FOLIO_STATUS }      = require('./Folio');
const { FolioRoutingRule, CHARGE_CATEGORIES }  = require('./FolioRoutingRule');
const Charge                                   = require('./Charge');
const { Payment, PAYMENT_METHOD }              = require('./Payment');
const Invoice                                  = require('./Invoice');

// Folio → Charges
Folio.hasMany(Charge,  { foreignKey: 'folio_id', as: 'charges' });
Charge.belongsTo(Folio, { foreignKey: 'folio_id', as: 'folio' });

// Folio → Payments
Folio.hasMany(Payment,  { foreignKey: 'folio_id', as: 'payments' });
Payment.belongsTo(Folio, { foreignKey: 'folio_id', as: 'folio' });

// Folio → Invoice
Folio.hasMany(Invoice,  { foreignKey: 'folio_id', as: 'invoices' });
Invoice.belongsTo(Folio, { foreignKey: 'folio_id', as: 'folio' });

// Folio → RoutingRules (as source and target)
Folio.hasMany(FolioRoutingRule, { foreignKey: 'source_folio_id', as: 'routing_rules' });

// CashierShift → Payments
CashierShift.hasMany(Payment, { foreignKey: 'shift_id', as: 'payments' });
Payment.belongsTo(CashierShift, { foreignKey: 'shift_id', as: 'shift' });

module.exports = {
  CashierShift, SHIFT_STATUS,
  ExchangeRate,
  Folio, FOLIO_TYPE, FOLIO_STATUS,
  FolioRoutingRule, CHARGE_CATEGORIES,
  Charge,
  Payment, PAYMENT_METHOD,
  Invoice,
};
