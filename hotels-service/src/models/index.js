const { sequelize }             = require('../config/database');
const HotelSettings               = require('./HotelSettings');
const RoomType                    = require('./RoomType');
const { Room, ROOM_STATUS }       = require('./Room');
const { LendableItem, ItemInventory } = require('./LendableItem');
const { RoomIncidentLog, MaintenanceLog, INCIDENT_STATUS } = require('./MaintenanceLog');

const Amenity                     = require('./Amenity');
const BedType                     = require('./BedType');
const RoomTypeAmenity             = require('./RoomTypeAmenity');
const RoomTypeBed                 = require('./RoomTypeBed');

// Room → RoomType
Room.belongsTo(RoomType, { foreignKey: 'room_type_id', as: 'room_type' });
RoomType.hasMany(Room,   { foreignKey: 'room_type_id', as: 'rooms' });

// RoomType <-> Amenity
RoomType.belongsToMany(Amenity, { through: RoomTypeAmenity, foreignKey: 'room_type_id', as: 'amenities' });
Amenity.belongsToMany(RoomType, { through: RoomTypeAmenity, foreignKey: 'amenity_id', as: 'room_types' });

// RoomType <-> BedType
RoomType.belongsToMany(BedType, { through: RoomTypeBed, foreignKey: 'room_type_id', as: 'beds' });
BedType.belongsToMany(RoomType, { through: RoomTypeBed, foreignKey: 'bed_type_id', as: 'room_types' });

// ItemInventory → LendableItem (1-to-1 per tenant)
ItemInventory.belongsTo(LendableItem, { foreignKey: 'item_id', as: 'item' });
LendableItem.hasOne(ItemInventory,    { foreignKey: 'item_id', as: 'inventory' });

// RoomIncidentLog → Room
RoomIncidentLog.belongsTo(Room,         { foreignKey: 'room_id', as: 'room' });
RoomIncidentLog.belongsTo(LendableItem, { foreignKey: 'item_id', as: 'item' });
Room.hasMany(RoomIncidentLog,           { foreignKey: 'room_id', as: 'incidents' });

module.exports = {
  HotelSettings,
  RoomType,
  Room, ROOM_STATUS,
  Amenity, BedType, RoomTypeAmenity, RoomTypeBed,
  LendableItem, ItemInventory,
  RoomIncidentLog, MaintenanceLog, INCIDENT_STATUS,
  sequelize
};
