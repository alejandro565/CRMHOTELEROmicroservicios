const { Amenity } = require('../models');
const AppError = require('../middlewares/AppError');

async function createAmenity({ tenant_id, name, description, icon }) {
  const exists = await Amenity.findOne({ where: { tenant_id, name } });
  if (exists) throw new AppError(`La amenidad "${name}" ya existe`, 409, 'AMENITY_EXISTS');

  return Amenity.create({ tenant_id, name, description, icon });
}

async function listAmenities(tenant_id) {
  return Amenity.findAll({ where: { tenant_id }, order: [['name', 'ASC']] });
}

async function updateAmenity(id, tenant_id, data) {
  const amenity = await Amenity.findOne({ where: { id, tenant_id } });
  if (!amenity) throw new AppError('Amenidad no encontrada', 404, 'AMENITY_NOT_FOUND');

  await amenity.update(data);
  return amenity;
}

async function deleteAmenity(id, tenant_id) {
  const amenity = await Amenity.findOne({ where: { id, tenant_id } });
  if (!amenity) throw new AppError('Amenidad no encontrada', 404, 'AMENITY_NOT_FOUND');

  await amenity.destroy();
  return { deleted: true, id };
}

module.exports = { createAmenity, listAmenities, updateAmenity, deleteAmenity };
