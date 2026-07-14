const { BedType } = require('../models');
const AppError = require('../middlewares/AppError');

async function createBedType({ tenant_id, name, description }) {
  const exists = await BedType.findOne({ where: { tenant_id, name } });
  if (exists) throw new AppError(`El tipo de cama "${name}" ya existe`, 409, 'BED_TYPE_EXISTS');

  return BedType.create({ tenant_id, name, description });
}

async function listBedTypes(tenant_id) {
  return BedType.findAll({ where: { tenant_id }, order: [['name', 'ASC']] });
}

async function updateBedType(id, tenant_id, data) {
  const bedType = await BedType.findOne({ where: { id, tenant_id } });
  if (!bedType) throw new AppError('Tipo de cama no encontrado', 404, 'BED_TYPE_NOT_FOUND');

  await bedType.update(data);
  return bedType;
}

async function deleteBedType(id, tenant_id) {
  const bedType = await BedType.findOne({ where: { id, tenant_id } });
  if (!bedType) throw new AppError('Tipo de cama no encontrado', 404, 'BED_TYPE_NOT_FOUND');

  await bedType.destroy();
  return { deleted: true, id };
}

module.exports = { createBedType, listBedTypes, updateBedType, deleteBedType };
