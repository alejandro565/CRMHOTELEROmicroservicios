const { RoomType, Amenity, BedType, RoomTypeBed, sequelize } = require('../models');
const AppError = require('../middlewares/AppError');

async function createRoomType({ 
  tenant_id, name, description, max_capacity, base_price, 
  bathroom_type, amenity_ids = [], beds = [] 
}) {
  const t = await sequelize.transaction();
  try {
    const exists = await RoomType.findOne({ where: { tenant_id, name }, transaction: t });
    if (exists) throw new AppError(`El tipo "${name}" ya existe`, 409, 'ROOM_TYPE_EXISTS');

    const rt = await RoomType.create({ 
      tenant_id, name, description, max_capacity, base_price, bathroom_type 
    }, { transaction: t });

    // Link amenities
    if (amenity_ids.length > 0) {
      await rt.setAmenities(amenity_ids, { transaction: t });
    }

    // Link beds (with count)
    if (beds.length > 0) {
      for (const bed of beds) {
        await RoomTypeBed.create({
          room_type_id: rt.id,
          bed_type_id: bed.bed_type_id,
          count: bed.count || 1
        }, { transaction: t });
      }
    }

    await t.commit();
    return getRoomType(rt.id, tenant_id); // Return with associations
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

async function listRoomTypes(tenant_id) {
  const { Room } = require('../models');
  return RoomType.findAll({ 
    where: { tenant_id }, 
    attributes: {
      include: [
        [
          sequelize.literal(`(
            SELECT COUNT(*)
            FROM rooms AS room
            WHERE
              room.room_type_id = "RoomType"."id"
              AND room.tenant_id = "RoomType"."tenant_id"
          )`),
          'total_count'
        ]
      ]
    },
    include: [
      { model: Amenity, as: 'amenities', through: { attributes: [] } },
      { model: BedType, as: 'beds' }
    ],
    order: [['name', 'ASC']] 
  });
}

async function getRoomType(id, tenant_id) {
  const rt = await RoomType.findOne({ 
    where: { id, tenant_id },
    include: [
      { model: Amenity, as: 'amenities', through: { attributes: [] } },
      { model: BedType, as: 'beds' }
    ]
  });
  if (!rt) throw new AppError('Tipo de habitación no encontrado', 404, 'ROOM_TYPE_NOT_FOUND');
  return rt;
}

async function updateRoomType(id, tenant_id, data) {
  const { amenity_ids, beds, ...rest } = data;
  const t = await sequelize.transaction();
  
  try {
    const rt = await RoomType.findOne({ where: { id, tenant_id }, transaction: t });
    if (!rt) throw new AppError('Tipo de habitación no encontrado', 404, 'ROOM_TYPE_NOT_FOUND');

    await rt.update(rest, { transaction: t });

    if (amenity_ids !== undefined) {
      await rt.setAmenities(amenity_ids, { transaction: t });
    }

    if (beds !== undefined) {
      // Re-sync beds: delete old and insert new
      await RoomTypeBed.destroy({ where: { room_type_id: id }, transaction: t });
      for (const bed of beds) {
        await RoomTypeBed.create({
          room_type_id: id,
          bed_type_id: bed.bed_type_id,
          count: bed.count || 1
        }, { transaction: t });
      }
    }

    await t.commit();
    return getRoomType(id, tenant_id);
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

async function deleteRoomType(id, tenant_id) {
  const rt = await RoomType.findOne({ where: { id, tenant_id } });
  if (!rt) throw new AppError('Tipo de habitación no encontrado', 404, 'ROOM_TYPE_NOT_FOUND');

  const { Room } = require('../models');
  const count = await Room.count({ where: { room_type_id: id } });
  if (count > 0) {
    throw new AppError(
      `No se puede eliminar: ${count} habitación(es) usan este tipo`,
      409, 'ROOM_TYPE_IN_USE', { rooms_count: count }
    );
  }
  
  // Pivot records will be deleted by associations if configured or manual
  // RoomTypeAmenity and RoomTypeBed are handled by onDelete CASCADE usually, 
  // but to be safe we can let rt.destroy() handle it if associations are set up correctly.
  await rt.destroy();
  return { deleted: true, id };
}

module.exports = { createRoomType, listRoomTypes, getRoomType, updateRoomType, deleteRoomType };

