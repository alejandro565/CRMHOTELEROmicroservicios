const { SystemModule } = require('../models');
const AppError = require('../middlewares/AppError');

/**
 * Register a new system module (slug-based PK).
 */
async function registerSystemModule({ id, name, description, is_active = true }) {
  const existing = await SystemModule.findByPk(id);
  if (existing) {
    throw new AppError(`El módulo "${id}" ya existe`, 409, 'MODULE_SLUG_EXISTS');
  }

  // Validate slug format: uppercase letters, numbers and underscores only
  if (!/^[A-Z0-9_]+$/.test(id)) {
    throw new AppError(
      'El slug del módulo solo puede contener letras mayúsculas, números y guiones bajos',
      400,
      'INVALID_SLUG_FORMAT'
    );
  }

  const module_ = await SystemModule.create({ id, name, description, is_active });
  return module_;
}

/**
 * Toggle a module's is_active flag globally.
 * Disabling a module doesn't remove existing plan associations —
 * it only prevents new plans from including it.
 */
async function toggleModule(id, is_active) {
  const module_ = await SystemModule.findByPk(id);
  if (!module_) {
    throw new AppError(`Módulo "${id}" no encontrado`, 404, 'MODULE_NOT_FOUND');
  }
  await module_.update({ is_active });
  return module_;
}

async function listModules({ activeOnly = false } = {}) {
  const where = activeOnly ? { is_active: true } : {};
  return SystemModule.findAll({ where, order: [['id', 'ASC']] });
}

module.exports = { registerSystemModule, toggleModule, listModules };
