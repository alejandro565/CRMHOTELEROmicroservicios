const { Op } = require('sequelize');
const { Guest, GuestStats, GuestDocument, LoyaltyLevel, Company } = require('../models');
const AppError = require('../middlewares/AppError');
const { publishEvent } = require('../config/rabbitmq');
const { notifyAudit } = require('./audit.client');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _fullProfile(guest) {
  return {
    id:          guest.id,
    full_name:   `${guest.first_name} ${guest.last_name}`,
    first_name:  guest.first_name,
    last_name:   guest.last_name,
    doc_type:    guest.doc_type,
    doc_number:  guest.doc_number,
    email:       guest.email,
    phone:       guest.phone,
    nationality: guest.nationality,
    gender:      guest.gender,
    birth_date:  guest.birth_date,
    civil_status: guest.civil_status,
    company_id:  guest.company_id,
    notes:       guest.notes,
    stats:       guest.stats || null,
    documents:   guest.documents || [],
    updated_at:  guest.updated_at,
  };
}

async function _findGuest(id, tenant_id) {
  const guest = await Guest.findOne({
    where: { id, tenant_id, merged_into_id: null },
    include: [
      {
        model: GuestStats, as: 'stats',
        include: [{ model: LoyaltyLevel, as: 'loyalty_level' }],
      },
      { model: GuestDocument, as: 'documents' },
      { model: Company, as: 'company', attributes: ['id', 'business_name', 'corporate_discount'] },
    ],
  });
  if (!guest) throw new AppError('Huésped no encontrado', 404, 'GUEST_NOT_FOUND');
  return guest;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

async function createGuest(data, actor_user_id) {
  const { tenant_id, doc_type, doc_number } = data;

  const duplicate = await Guest.findOne({ where: { tenant_id, doc_type, doc_number, merged_into_id: null } });
  if (duplicate) {
    throw new AppError(
      `Ya existe un huésped con ${doc_type} ${doc_number}`,
      409, 'GUEST_DOC_DUPLICATE',
      { existing_id: duplicate.id }
    );
  }

  const t = await Guest.sequelize.transaction();
  try {
    const guest = await Guest.create(data, { transaction: t });

    // Auto-create stats row linked to default loyalty level
    const defaultLevel = await LoyaltyLevel.findOne({ where: { tenant_id, is_default: true } });
    await GuestStats.create(
      {
        guest_id:                  guest.id,
        tenant_id,
        total_stays:               0,
        total_spent:               0,
        current_loyalty_level_id:  defaultLevel?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    notifyAudit({ tenant_id, actor_user_id, entity: 'guest', entity_id: guest.id, action: 'CREATE' });
    return _fullProfile(await _findGuest(guest.id, tenant_id));
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

async function listGuests(tenant_id, { page = 1, limit = 20, search } = {}) {
  const where = { tenant_id, merged_into_id: null };
  if (search) {
    where[Op.or] = [
      { first_name: { [Op.iLike]: `%${search}%` } },
      { last_name:  { [Op.iLike]: `%${search}%` } },
      { doc_number: { [Op.iLike]: `%${search}%` } },
      { email:      { [Op.iLike]: `%${search}%` } },
    ];
  }
  const { count, rows } = await Guest.findAndCountAll({
    where,
    include: [{ model: GuestStats, as: 'stats', include: [{ model: LoyaltyLevel, as: 'loyalty_level' }] }],
    order: [['last_name', 'ASC'], ['first_name', 'ASC']],
    limit,
    offset: (page - 1) * limit,
  });
  return { total: count, page, total_pages: Math.ceil(count / limit), data: rows.map(_fullProfile) };
}

async function getGuest(id, tenant_id) {
  return _fullProfile(await _findGuest(id, tenant_id));
}

async function updateGuest(id, tenant_id, data, actor_user_id) {
  const guest = await _findGuest(id, tenant_id);
  await guest.update(data);
  notifyAudit({ tenant_id, actor_user_id, entity: 'guest', entity_id: id, action: 'UPDATE', changes: data });
  return _fullProfile(await _findGuest(id, tenant_id));
}

async function deleteGuest(id, tenant_id, actor_user_id) {
  const guest = await _findGuest(id, tenant_id);
  // Soft approach: mark as merged_into_id = self (signals deleted without losing history)
  await guest.update({ merged_into_id: id });
  notifyAudit({ tenant_id, actor_user_id, entity: 'guest', entity_id: id, action: 'DELETE' });
  return { deleted: true, id };
}

// ─── Fast lookup (during reservation) ────────────────────────────────────────

async function findGuestByDocument(tenant_id, doc_type, doc_number) {
  const guest = await Guest.findOne({
    where: { tenant_id, doc_type, doc_number, merged_into_id: null },
    include: [
      { model: GuestStats, as: 'stats', include: [{ model: LoyaltyLevel, as: 'loyalty_level' }] },
    ],
  });
  if (!guest) throw new AppError('Huésped no encontrado', 404, 'GUEST_NOT_FOUND');
  return _fullProfile(guest);
}

// ─── Merge ────────────────────────────────────────────────────────────────────

/**
 * Merge a duplicate guest profile into the main one.
 * - Stats from duplicate are added to main (total_stays, total_spent)
 * - Documents from duplicate are re-linked to main
 * - Duplicate is soft-deleted (merged_into_id = mainId)
 * - Fires GUEST_MERGED so reservation-service can update its foreign keys
 */
async function mergeGuests(mainId, duplicateId, tenant_id, actor_user_id) {
  if (mainId === duplicateId) throw new AppError('Los IDs deben ser diferentes', 400, 'SAME_GUEST_ID');

  const main      = await _findGuest(mainId, tenant_id);
  const duplicate = await _findGuest(duplicateId, tenant_id);

  const t = await Guest.sequelize.transaction();
  try {
    // Merge stats
    const mainStats = await GuestStats.findOne({ where: { guest_id: mainId } });
    const dupStats  = await GuestStats.findOne({ where: { guest_id: duplicateId } });

    if (mainStats && dupStats) {
      await mainStats.update(
        {
          total_stays: mainStats.total_stays + dupStats.total_stays,
          total_spent: Number(mainStats.total_spent) + Number(dupStats.total_spent),
          last_visit_at: mainStats.last_visit_at > dupStats.last_visit_at
            ? mainStats.last_visit_at
            : dupStats.last_visit_at,
        },
        { transaction: t }
      );
    }

    // Re-link documents
    await GuestDocument.update(
      { guest_id: mainId },
      { where: { guest_id: duplicateId }, transaction: t }
    );

    // Soft-delete the duplicate
    await duplicate.update({ merged_into_id: mainId }, { transaction: t });

    await t.commit();

    publishEvent('guest.merged', {
      tenant_id,
      main_guest_id:      mainId,
      duplicate_guest_id: duplicateId,
      occurred_at:        new Date().toISOString(),
    });

    notifyAudit({ tenant_id, actor_user_id, entity: 'guest', entity_id: mainId, action: 'MERGE', changes: { merged: duplicateId } });

    return { main_guest_id: mainId, duplicate_merged: duplicateId };
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

// ─── Documents ────────────────────────────────────────────────────────────────

async function addDocument({ guest_id, tenant_id, document_url, doc_type, expiry_date, uploaded_by_user_id }) {
  await _findGuest(guest_id, tenant_id); // ensure guest exists and belongs to tenant
  return GuestDocument.create({ guest_id, tenant_id, document_url, doc_type, expiry_date, uploaded_by_user_id });
}

async function deleteDocument(doc_id, tenant_id) {
  const doc = await GuestDocument.findOne({ where: { id: doc_id, tenant_id } });
  if (!doc) throw new AppError('Documento no encontrado', 404, 'DOCUMENT_NOT_FOUND');
  await doc.destroy();
  return { deleted: true, id: doc_id };
}

module.exports = {
  createGuest, listGuests, getGuest, updateGuest, deleteGuest,
  findGuestByDocument, mergeGuests, addDocument, deleteDocument,
};
