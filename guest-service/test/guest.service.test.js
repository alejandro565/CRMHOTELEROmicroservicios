jest.mock('../src/models', () => {
  const mockT = { commit: jest.fn(), rollback: jest.fn() };
  const mockGuest = {
    id: 'guest-001', first_name: 'Juan', last_name: 'Perez',
    doc_type: 'CI', doc_number: '1234567', tenant_id: 'tenant-001',
    merged_into_id: null,
    update: jest.fn().mockResolvedValue(true),
  };
  const mockStats = {
    guest_id: 'guest-001', total_stays: 0, total_spent: 0,
    update: jest.fn(), reload: jest.fn(),
  };
  return {
    Guest: {
      findOne: jest.fn(),
      findAndCountAll: jest.fn(),
      create: jest.fn().mockResolvedValue(mockGuest),
      sequelize: { transaction: jest.fn().mockResolvedValue(mockT) },
    },
    GuestStats: { create: jest.fn().mockResolvedValue(mockStats), findOne: jest.fn() },
    GuestDocument: { update: jest.fn() },
    LoyaltyLevel: { findOne: jest.fn().mockResolvedValue({ id: 'lvl-normal' }) },
    Company: {},
    _mocks: { mockGuest, mockStats, mockT },
  };
});

jest.mock('../src/config/rabbitmq', () => ({ publishEvent: jest.fn() }));
jest.mock('../src/services/audit.client', () => ({ notifyAudit: jest.fn() }));

const { Guest, GuestStats, _mocks } = require('../src/models');
const { publishEvent } = require('../src/config/rabbitmq');
const guestService = require('../src/services/guest.service');

beforeEach(() => jest.clearAllMocks());

// ... (tus mocks iniciales se mantienen igual)

describe('createGuest()', () => {
  it('creates guest and auto-creates stats row', async () => {
    Guest.findOne
      .mockResolvedValueOnce(null)   // No hay duplicados
      .mockResolvedValueOnce({       // Respuesta de _findGuest
        ..._mocks.mockGuest,
        stats: { total_stays: 0, loyalty_level: { name: 'Normal' } },
        documents: [],
      });

    const result = await guestService.createGuest(
      { tenant_id: 'tenant-001', first_name: 'Juan', last_name: 'Perez', doc_type: 'CI', doc_number: '1234567' },
      'user-001'
    );

    expect(Guest.create).toHaveBeenCalledTimes(1);
    expect(GuestStats.create).toHaveBeenCalledTimes(1);
    expect(_mocks.mockT.commit).toHaveBeenCalled();
    expect(result.full_name).toBe('Juan Perez');
  });

  it('throws GUEST_DOC_DUPLICATE when document is already registered', async () => {
    // 1. Simulamos que encuentra un duplicado
    Guest.findOne.mockResolvedValue(_mocks.mockGuest);

    await expect(
      guestService.createGuest(
        { tenant_id: 'tenant-001', doc_type: 'CI', doc_number: '1234567' },
        'user-001'
      )
    ).rejects.toMatchObject({ 
      code: 'GUEST_DOC_DUPLICATE', 
      meta: { existing_id: 'guest-001' } 
    });

    // 2. CORRECCIÓN: No debe llamarse a rollback porque la transacción ni siquiera empezó
    expect(_mocks.mockT.rollback).not.toHaveBeenCalled();
    expect(Guest.create).not.toHaveBeenCalled();
  });

  it('rolls back transaction if stats creation fails', async () => {
    // Simulamos que el duplicado no existe pero la creación de stats falla
    Guest.findOne.mockResolvedValue(null);
    Guest.create.mockResolvedValue(_mocks.mockGuest);
    GuestStats.create.mockRejectedValue(new Error('DB Error'));

    await expect(
      guestService.createGuest(
        { tenant_id: 'tenant-001', first_name: 'Error' },
        'user-001'
      )
    ).rejects.toThrow('DB Error');

    // Aquí SÍ debe haber ocurrido un rollback porque el error fue dentro del try/catch
    expect(_mocks.mockT.rollback).toHaveBeenCalled();
  });
});

describe('mergeGuests()', () => {
  it('throws SAME_GUEST_ID when both IDs are equal', async () => {
    await expect(
      guestService.mergeGuests('same-id', 'same-id', 'tenant-001', 'user-001')
    ).rejects.toMatchObject({ code: 'SAME_GUEST_ID' });
    
    // Al igual que en createGuest, este error ocurre antes de la transacción
    expect(_mocks.mockT.rollback).not.toHaveBeenCalled();
  });

  it('publishes GUEST_MERGED event on success', async () => {
    const mainGuest = { ..._mocks.mockGuest, id: 'main-id', update: jest.fn() };
    const dupGuest  = { ..._mocks.mockGuest, id: 'dup-id',  update: jest.fn() };
    const mainStats = { total_stays: 5, total_spent: 200, last_visit_at: new Date('2024-01-10'), update: jest.fn() };
    const dupStats  = { total_stays: 3, total_spent: 100, last_visit_at: new Date('2024-01-05'), update: jest.fn() };

    // Mocks para _findGuest (usado 2 veces) y GuestStats.findOne (usado 2 veces)
    Guest.findOne
      .mockResolvedValueOnce({ ...mainGuest, stats: mainStats, documents: [] })
      .mockResolvedValueOnce({ ...dupGuest,  stats: dupStats,  documents: [] });

    GuestStats.findOne
      .mockResolvedValueOnce(mainStats)
      .mockResolvedValueOnce(dupStats);

    const result = await guestService.mergeGuests('main-id', 'dup-id', 'tenant-001', 'user-001');

    expect(publishEvent).toHaveBeenCalledWith('guest.merged', expect.objectContaining({
      main_guest_id: 'main-id',
      duplicate_guest_id: 'dup-id',
    }));
    expect(_mocks.mockT.commit).toHaveBeenCalled();
    expect(result.main_guest_id).toBe('main-id');
  });
});