jest.mock('../src/models', () => {
  const mockRoomType = { id: 'rt-001', name: 'Simple', tenant_id: 'tenant-001' };
  const mockRoom = {
    id: 'room-001', number: '101', floor: 1,
    status: 'CLEAN', tenant_id: 'tenant-001',
    update: jest.fn().mockResolvedValue(true),
    destroy: jest.fn().mockResolvedValue(true),
  };
  return {
    Room:     { findOne: jest.fn(), count: jest.fn(), bulkCreate: jest.fn(), findAll: jest.fn(), create: jest.fn() },
    RoomType: { findOne: jest.fn().mockResolvedValue(mockRoomType) },
    LendableItem: { findOne: jest.fn() },
    ItemInventory: { findOne: jest.fn() },
    RoomIncidentLog: { count: jest.fn().mockResolvedValue(0) },
    ROOM_STATUS: { CLEAN: 'CLEAN', DIRTY: 'DIRTY', MAINTENANCE: 'MAINTENANCE', OCCUPIED: 'OCCUPIED' },
    _mocks: { mockRoom, mockRoomType },
  };
});

jest.mock('../src/config/rabbitmq', () => ({ publishEvent: jest.fn() }));

const { Room, RoomType, LendableItem, ItemInventory, ROOM_STATUS, _mocks } = require('../src/models');
const { publishEvent } = require('../src/config/rabbitmq');
const roomService = require('../src/services/room.service');

beforeEach(() => {
  jest.clearAllMocks();
  LendableItem.findOne.mockResolvedValue(null);
  ItemInventory.findOne.mockResolvedValue(null);
});

describe('createRoom()', () => {
  it('creates a room when number is unique', async () => {
    RoomType.findOne.mockResolvedValueOnce(_mocks.mockRoomType);
    Room.findOne.mockResolvedValueOnce(null); // no duplicate number
    // Re-mock create
    Room.create = jest.fn().mockResolvedValue(_mocks.mockRoom);

    const result = await roomService.createRoom({
      tenant_id: 'tenant-001', room_type_id: 'rt-001', number: '101', floor: 1,
    });
    expect(Room.create).toHaveBeenCalledTimes(1);
    expect(result.number).toBe('101');
  });

  it('throws ROOM_NUMBER_EXISTS when number is taken', async () => {
    RoomType.findOne.mockResolvedValueOnce(_mocks.mockRoomType); // room_type found
    Room.findOne.mockResolvedValueOnce(_mocks.mockRoom);        // number duplicate

    await expect(roomService.createRoom({
      tenant_id: 'tenant-001', room_type_id: 'rt-001', number: '101', floor: 1,
    })).rejects.toMatchObject({ code: 'ROOM_NUMBER_EXISTS' });
  });
});

describe('updateRoomStatus()', () => {
  it('updates status and publishes event', async () => {
    Room.findOne.mockResolvedValue({ ..._mocks.mockRoom, status: 'DIRTY' });

    await roomService.updateRoomStatus('room-001', 'tenant-001', ROOM_STATUS.CLEAN, 'user-001');

    expect(_mocks.mockRoom.update).toHaveBeenCalledWith({ status: 'CLEAN' });
    expect(publishEvent).toHaveBeenCalledWith('room.status_changed', expect.objectContaining({
      new_status: 'CLEAN',
      prev_status: 'DIRTY',
    }));
  });

  it('throws ROOM_IN_MAINTENANCE when room is in maintenance', async () => {
    Room.findOne.mockResolvedValue({ ..._mocks.mockRoom, status: 'MAINTENANCE' });

    await expect(
      roomService.updateRoomStatus('room-001', 'tenant-001', ROOM_STATUS.CLEAN, 'user-001')
    ).rejects.toMatchObject({ code: 'ROOM_IN_MAINTENANCE' });
  });
});

describe('massCreateRooms()', () => {
  it('throws INVALID_COUNT when count is 0 or negative', async () => {
    await expect(
      roomService.massCreateRooms({ tenant_id: 'tenant-001', room_type_id: 'rt-001', prefix: '1', start: 1, count: 0 })
    ).rejects.toMatchObject({ code: 'INVALID_COUNT' });
  });

  it('bulk-creates rooms in range', async () => {
    RoomType.findOne.mockResolvedValueOnce(_mocks.mockRoomType);
    Room.bulkCreate.mockResolvedValue(new Array(5).fill({}));

    const result = await roomService.massCreateRooms({
      tenant_id: 'tenant-001', room_type_id: 'rt-001', prefix: '1', start: 1, count: 5,
    });

    expect(Room.bulkCreate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ number: '11' }),
        expect.objectContaining({ number: '15' }),
      ]),
      { ignoreDuplicates: true }
    );
    expect(result.requested).toBe(5);
    expect(result.created).toBe(5);
  });
});
