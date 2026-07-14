const { publishEvent } = require('../config/rabbitmq');
const EVENTS = require('./eventKeys');

function publishTenantProvisioned({ tenant_id, plan_config }) {
  publishEvent(EVENTS.TENANT_PROVISIONED, {
    tenant_id,
    plan_config, // { max_rooms, modules: string[] }
    occurred_at: new Date().toISOString(),
  });
}

function publishTenantSuspended({ tenant_id, reason }) {
  publishEvent(EVENTS.TENANT_SUSPENDED, {
    tenant_id,
    reason: reason || null,
    occurred_at: new Date().toISOString(),
  });
}

function publishTenantPlanChanged({ tenant_id, old_plan_id, new_plan_id, new_config }) {
  publishEvent(EVENTS.TENANT_PLAN_CHANGED, {
    tenant_id,
    old_plan_id,
    new_plan_id,
    new_config, // { max_rooms, modules: string[] }
    occurred_at: new Date().toISOString(),
  });
}

function publishTenantDeleted({ tenant_id }) {
  const purge_after = new Date();
  purge_after.setDate(purge_after.getDate() + 60);

  publishEvent(EVENTS.TENANT_DELETED, {
    tenant_id,
    purge_after: purge_after.toISOString(),
    occurred_at: new Date().toISOString(),
  });
}

function publishTenantUpdated({ tenant_id, name, tax_id }) {
  publishEvent(EVENTS.TENANT_UPDATED, {
    tenant_id,
    name,
    tax_id,
    occurred_at: new Date().toISOString(),
  });
}

module.exports = {
  publishTenantProvisioned,
  publishTenantSuspended,
  publishTenantPlanChanged,
  publishTenantDeleted,
  publishTenantUpdated,
};
