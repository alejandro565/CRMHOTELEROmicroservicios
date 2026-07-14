const { Op } = require('sequelize');
const { ActivityLog, DataDiff } = require('../models/index');

// ─── Ingest ───────────────────────────────────────────────────────────────────

/**
 * Core ingestion function. Called from both the RabbitMQ consumer
 * and the internal HTTP endpoint (direct calls from guest-service etc.).
 *
 * @param {object} event
 * @param {string} event.tenant_id
 * @param {string} event.user_id
 * @param {string} event.action   — one of AUDIT_ACTIONS
 * @param {string} event.module   — one of AUDIT_MODULES
 * @param {string} [event.entity_id]
 * @param {string} [event.ip_address]
 * @param {string} [event.user_agent]
 * @param {object} [event.payload]  — { before, after } or any context
 * @param {string} [event.occurred_at]
 */
async function ingestLog(event) {
  const {
    tenant_id, user_id, action, module: mod,
    entity_id, ip_address, user_agent,
    payload, occurred_at,
  } = event;

  // Validate required fields loosely — audit must never throw and block the caller
  if (!action || !mod) {
    console.warn('[AuditService] ingestLog skipped — missing action or module', event);
    return null;
  }

  const log = await ActivityLog.create({
    tenant_id:  tenant_id || null,
    user_id:    user_id   || null,
    action,
    module:     mod,
    entity_id:  entity_id  || null,
    ip_address: ip_address || null,
    user_agent: user_agent || null,
    meta:       payload    || {},
    occurred_at: occurred_at ? new Date(occurred_at) : new Date(),
  });

  // If payload has before/after, persist the diff
  if (payload?.before !== undefined || payload?.after !== undefined) {
    await DataDiff.create({
      log_id:         log.id,
      previous_state: payload.before || null,
      new_state:      payload.after  || null,
    });
  }

  return log;
}

// ─── Query ────────────────────────────────────────────────────────────────────

async function getAuditByEntity(entity_id, tenant_id, { page = 1, limit = 50 } = {}) {
  const { count, rows } = await ActivityLog.findAndCountAll({
    where: { entity_id, tenant_id },
    include: [{ model: DataDiff, as: 'diff', required: false }],
    order: [['occurred_at', 'DESC']],
    limit,
    offset: (page - 1) * limit,
  });
  return { total: count, page, total_pages: Math.ceil(count / limit), data: rows };
}

async function getAuditByUser(user_id, tenant_id, { page = 1, limit = 50, action } = {}) {
  const where = { user_id, tenant_id };
  if (action) where.action = action;
  const { count, rows } = await ActivityLog.findAndCountAll({
    where,
    order: [['occurred_at', 'DESC']],
    limit,
    offset: (page - 1) * limit,
  });
  return { total: count, page, total_pages: Math.ceil(count / limit), data: rows };
}

async function getAuditByTenant(tenant_id, { page = 1, limit = 50, module: mod, action, from, to } = {}) {
  const where = { tenant_id };
  if (mod)    where.module = mod;
  if (action) where.action = action;
  if (from || to) {
    where.occurred_at = {};
    if (from) where.occurred_at[Op.gte] = new Date(from);
    if (to)   where.occurred_at[Op.lte] = new Date(to);
  }
  const { count, rows } = await ActivityLog.findAndCountAll({
    where,
    include: [{ model: DataDiff, as: 'diff', required: false }],
    order: [['occurred_at', 'DESC']],
    limit,
    offset: (page - 1) * limit,
  });
  return { total: count, page, total_pages: Math.ceil(count / limit), data: rows };
}

// ─── Anomaly detection ────────────────────────────────────────────────────────

/**
 * Flag users who have performed an excessive number of VOID actions
 * within a rolling time window.
 * Returns a list of suspicious users with their void counts.
 */
async function detectAnomalies(tenant_id) {
  const threshold = parseInt(process.env.ANOMALY_VOID_THRESHOLD || '5', 10);
  const windowMin = parseInt(process.env.ANOMALY_WINDOW_MINUTES  || '60', 10);
  const since     = new Date(Date.now() - windowMin * 60 * 1000);

  const logs = await ActivityLog.findAll({
    where: {
      tenant_id,
      action: 'VOID',
      occurred_at: { [Op.gte]: since },
    },
    attributes: ['user_id', [ActivityLog.sequelize.fn('COUNT', ActivityLog.sequelize.col('id')), 'void_count']],
    group: ['user_id'],
    having: ActivityLog.sequelize.literal(`COUNT(id) >= ${threshold}`),
    raw: true,
  });

  return {
    window_minutes: windowMin,
    threshold,
    suspicious_users: logs.map((l) => ({ user_id: l.user_id, void_count: parseInt(l.void_count) })),
  };
}

module.exports = { ingestLog, getAuditByEntity, getAuditByUser, getAuditByTenant, detectAnomalies };
