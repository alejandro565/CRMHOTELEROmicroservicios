/**
 * RabbitMQ routing keys for the hotel_events topic exchange.
 * Convention: <domain>.<action>
 */
const EVENTS = {
  TENANT_PROVISIONED:  'tenant.provisioned',
  TENANT_SUSPENDED:    'tenant.suspended',
  TENANT_PLAN_CHANGED: 'tenant.plan_changed',
  TENANT_DELETED:      'tenant.deleted',
  TENANT_UPDATED:      'tenant.updated',
};

module.exports = EVENTS;
