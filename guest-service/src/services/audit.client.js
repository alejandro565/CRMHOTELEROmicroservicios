const axios = require('axios');

const auditClient = axios.create({
  baseURL: process.env.AUDIT_SERVICE_URL || 'http://audit-service:3006',
  timeout: 3000,
  headers: { 'x-internal-token': process.env.INTERNAL_TOKEN },
});

/**
 * Fire-and-forget: sends an audit log entry.
 * Never throws — a failing audit log must not break guest operations.
 */
function notifyAudit({ tenant_id, actor_user_id, entity, entity_id, action, changes }) {
  auditClient
    .post('/internal/logs', { tenant_id, actor_user_id, entity, entity_id, action, changes, occurred_at: new Date().toISOString() })
    .catch((err) => console.warn('[AuditClient] failed to log:', err.message));
}

module.exports = { notifyAudit };
