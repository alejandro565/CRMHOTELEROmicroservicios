const { Permission } = require('../models');
const AppError = require('../middlewares/AppError');

/**
 * Create a new system permission.
 * Only called by the SuperAdmin via seed or internal tooling.
 */
async function createPermission({ module: mod, slug, description }) {
  if (!/^[A-Z0-9_]+$/.test(slug)) {
    throw new AppError(
      'El slug solo acepta mayúsculas, números y guiones bajos',
      400,
      'INVALID_SLUG_FORMAT'
    );
  }
  const existing = await Permission.findOne({ where: { slug } });
  if (existing) throw new AppError(`El permiso "${slug}" ya existe`, 409, 'PERMISSION_EXISTS');

  return Permission.create({ module: mod, slug, description });
}

/**
 * Returns permissions grouped by module.
 * Used by the tenant admin to build the role assignment UI.
 */
async function listGroupedByModule() {
  const all = await Permission.findAll({ order: [['module', 'ASC'], ['slug', 'ASC']] });

  // Group into { module: [{ slug, description }] }
  const grouped = {};
  for (const p of all) {
    if (!grouped[p.module]) grouped[p.module] = [];
    grouped[p.module].push({ slug: p.slug, desc: p.description });
  }

  return Object.entries(grouped).map(([module, permissions]) => ({
    module,
    permissions,
  }));
}

async function listAll() {
  return Permission.findAll({ order: [['module', 'ASC'], ['slug', 'ASC']] });
}

module.exports = { createPermission, listGroupedByModule, listAll };
