const { Amenity, BedType, RoomType, RoomTypeBed, LendableItem, ItemInventory, sequelize } = require('../models');

async function seedHotelDefaults(tenant_id) {
  const t = await sequelize.transaction();
  try {
    // 1. Amenities
    const amenities = [
      { name: 'Wi-Fi Alta Velocidad', icon: 'Wifi' },
      { name: 'Aire Acondicionado', icon: 'Wind' },
      { name: 'Smart TV 55"', icon: 'Tv' },
      { name: 'Caja Fuerte', icon: 'Lock' },
      { name: 'Minibar', icon: 'Coffee' },
    ];

    const createdAmenities = [];
    for (const a of amenities) {
      const [inst] = await Amenity.findOrCreate({
        where: { tenant_id, name: a.name },
        defaults: { ...a, tenant_id },
        transaction: t
      });
      createdAmenities.push(inst);
    }

    // 2. Bed Types
    const beds = [
      { name: 'Cama King Size', description: 'Cama de lujo 2x2 metros' },
      { name: 'Cama Matrimonial', description: 'Cama estándar para 2 personas' },
      { name: 'Cama Individual', description: 'Cama para 1 persona' },
    ];

    const createdBeds = [];
    for (const b of beds) {
      const [inst] = await BedType.findOrCreate({
        where: { tenant_id, name: b.name },
        defaults: { ...b, tenant_id },
        transaction: t
      });
      createdBeds.push(inst);
    }

    // 3. Room Types
    const roomTypes = [
      { 
        name: 'Habitación Estándar', 
        max_capacity: 2, 
        base_price: 250, 
        bathroom_type: 'PRIVATE',
        bed_links: [{ name: 'Cama Matrimonial', count: 1 }],
        amenity_links: ['Wi-Fi Alta Velocidad', 'Smart TV 55"', 'Aire Acondicionado']
      },
      { 
        name: 'Suite Ejecutiva', 
        max_capacity: 2, 
        base_price: 550, 
        bathroom_type: 'PRIVATE',
        bed_links: [{ name: 'Cama King Size', count: 1 }],
        amenity_links: ['Wi-Fi Alta Velocidad', 'Smart TV 55"', 'Aire Acondicionado', 'Caja Fuerte', 'Minibar']
      }
    ];

    for (const rtDef of roomTypes) {
      const [rt] = await RoomType.findOrCreate({
        where: { tenant_id, name: rtDef.name },
        defaults: {
          tenant_id,
          name: rtDef.name,
          max_capacity: rtDef.max_capacity,
          base_price: rtDef.base_price,
          bathroom_type: rtDef.bathroom_type
        },
        transaction: t
      });

      // Link Amenities
      const amIds = createdAmenities
        .filter(a => rtDef.amenity_links.includes(a.name))
        .map(a => a.id);
      await rt.setAmenities(amIds, { transaction: t });

      // Link Beds
      for (const bl of rtDef.bed_links) {
        const bed = createdBeds.find(b => b.name === bl.name);
        if (bed) {
          // RoomTypeBed pivot
          await RoomTypeBed.findOrCreate({
            where: { room_type_id: rt.id, bed_type_id: bed.id },
            defaults: { count: bl.count },
            transaction: t
          });
        }
      }
    }

    // 4. Lendable Items (Keys)
    const [keyItem] = await LendableItem.findOrCreate({
      where: { tenant_id, name: 'Llave de Habitación' },
      defaults: {
        tenant_id,
        name: 'Llave de Habitación',
        description: 'Llave física o tarjeta de acceso a la habitación',
        replacement_cost: 50
      },
      transaction: t
    });

    await ItemInventory.findOrCreate({
      where: { tenant_id, item_id: keyItem.id },
      defaults: {
        tenant_id,
        item_id: keyItem.id,
        total_qty: 0,
        available_qty: 0,
        damaged_qty: 0,
        low_stock_threshold: 5
      },
      transaction: t
    });

    await t.commit();
    return { success: true, message: 'Hotel poblado con datos demo con éxito' };
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

module.exports = { seedHotelDefaults };
