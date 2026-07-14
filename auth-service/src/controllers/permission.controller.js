const permissionService = require('../services/permission.service');
const AppError = require('../middlewares/AppError');

async function list(req, res, next) {
  try {
    // ?grouped=true  → array of { module, permissions[] }
    // ?grouped=false → flat array
    const grouped = req.query.grouped !== 'false';
    const data = grouped
      ? await permissionService.listGroupedByModule()
      : await permissionService.listAll();

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { module: mod, slug, description } = req.body;
    if (!mod || !slug) {
      return next(new AppError('module y slug son requeridos', 400, 'VALIDATION_ERROR'));
    }
    const perm = await permissionService.createPermission({ module: mod, slug, description });
    res.status(201).json({ success: true, data: perm });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create };
