jest.mock('../src/models', () => {
  const mockT = { commit: jest.fn(), rollback: jest.fn() };
  const mockRoom = {
    id: 'room-001', number: '101', floor: 1, status: 'OCCUPIED', tenant_id: 'tenant-001',
    update: jest.fn().mockResolvedValue(true),
  };
  const mockIncident = {
    id: 'inc-001', room_id: 'room-001', tenant_id: 'tenant-001', status: 'OPEN',
    update: jest.fn().mockResolvedValue(true),
  };
  return {
    Room:            { findOne: jest.fn(), findByPk: jest.fn().mockResolvedValue(mockRoom),
                       sequelize: { transaction: jest.fn().mockResolvedValue(mockT) } },
    LendableItem:    { findByPk: jest.fn() },
    RoomIncidentLog: { create: jest.fn().mockResolvedValue(mockIncident), findOne: jest.fn(), count: jest.fn().mockResolvedValue(0) },
    MaintenanceLog:  { create: jest.fn().mockResolvedValue({}) },
    ROOM_STATUS:     { CLEAN:'CLEAN', DIRTY:'DIRTY', MAINTENANCE:'MAINTENANCE', OCCUPIED:'OCCUPIED' },
    INCIDENT_STATUS: { OPEN:'OPEN', RESOLVED:'RESOLVED' },
    _mocks: { mockRoom, mockIncident, mockT },
  };
});

jest.mock('../src/config/rabbitmq', () => ({ publishEvent: jest.fn() }));
jest.mock('sequelize', () => ({ Op: { ne: Symbol('ne') } }));

const { Room, RoomIncidentLog, ROOM_STATUS, _mocks } = require('../src/models');
const { publishEvent } = require('../src/config/rabbitmq');
const maintenanceService = require('../src/services/maintenance.service');

beforeEach(() => jest.clearAllMocks());

describe('reportDamage()', () => {
  it('sets room to MAINTENANCE and opens incident', async () => {
    Room.findOne.mockResolvedValue({ ..._mocks.mockRoom, status: 'OCCUPIED' });

    const result = await maintenanceService.reportDamage({
      tenant_id: 'tenant-001', room_id: 'room-001',
      description: 'Espejo roto', reported_by_user_id: 'user-001',
    });

    expect(_mocks.mockRoom.update).toHaveBeenCalledWith(
      { status: ROOM_STATUS.MAINTENANCE }, expect.anything()
    );
    expect(RoomIncidentLog.create).toHaveBeenCalledTimes(1);
    expect(publishEvent).toHaveBeenCalledWith('room.status_changed', expect.objectContaining({
      new_status: ROOM_STATUS.MAINTENANCE,
    }));
  });
});

describe('closeMaintenance()', () => {
  it('resolves incident and releases room to DIRTY when no other incidents remain', async () => {
    RoomIncidentLog.findOne.mockResolvedValue({ ..._mocks.mockIncident });
    RoomIncidentLog.count.mockResolvedValue(0);

    const result = await maintenanceService.closeMaintenance({
      tenant_id: 'tenant-001', incident_id: 'inc-001',
      repair_notes: 'Espejo reemplazado', resolved_by_user_id: 'user-001',
    });

    expect(_mocks.mockIncident.update).toHaveBeenCalledWith(
      { status: 'RESOLVED' }, expect.anything()
    );
    expect(_mocks.mockRoom.update).toHaveBeenCalledWith(
      { status: ROOM_STATUS.DIRTY }, expect.anything()
    );
    expect(result.room_released).toBe(true);
  });

  it('throws INCIDENT_NOT_FOUND for missing or closed incidents', async () => {
    RoomIncidentLog.findOne.mockResolvedValue(null);
    await expect(
      maintenanceService.closeMaintenance({
        tenant_id: 'tenant-001', incident_id: 'bad-id', repair_notes: '...', resolved_by_user_id: 'u',
      })
    ).rejects.toMatchObject({ code: 'INCIDENT_NOT_FOUND' });
  });
});
