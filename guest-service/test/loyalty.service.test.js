jest.mock('../src/models', () => {
  const mockLevel   = { id: 'lvl-normal', name: 'Normal', min_stays: 0, discount_percentage: 0, is_default: true };
  const mockGoldLvl = { id: 'lvl-gold',   name: 'Oro',    min_stays: 10, discount_percentage: 0.10, is_default: false };
  const mockStats   = {
    guest_id: 'guest-001', tenant_id: 'tenant-001',
    total_stays: 11, total_spent: 5000,
    current_loyalty_level_id: 'lvl-normal',
    loyalty_level: mockLevel,
    update: jest.fn().mockResolvedValue(true),
    reload: jest.fn().mockResolvedValue(true),
  };
  return {
    LoyaltyLevel: {
      findOne: jest.fn(),
      findOrCreate: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
    },
    GuestStats: { findOne: jest.fn().mockResolvedValue(mockStats), update: jest.fn() },
    _mocks: { mockLevel, mockGoldLvl, mockStats },
  };
});

jest.mock('../src/config/rabbitmq', () => ({ publishEvent: jest.fn() }));

// Mock sequelize Op
jest.mock('sequelize', () => ({ Op: { lte: Symbol('lte') } }));

const { LoyaltyLevel, GuestStats, _mocks } = require('../src/models');
const { publishEvent } = require('../src/config/rabbitmq');
const loyaltyService = require('../src/services/loyalty.service');

beforeEach(() => jest.clearAllMocks());

describe('recalculateGuestLoyalty()', () => {
  it('upgrades guest to Gold and publishes LOYALTY_LEVEL_UP event', async () => {
    GuestStats.findOne.mockResolvedValue(_mocks.mockStats);
    // Returns Gold as highest qualifying level
    LoyaltyLevel.findAll.mockResolvedValue([_mocks.mockGoldLvl]);

    await loyaltyService.recalculateGuestLoyalty('guest-001', 'tenant-001');

    expect(_mocks.mockStats.update).toHaveBeenCalledWith({ current_loyalty_level_id: 'lvl-gold' });
    expect(publishEvent).toHaveBeenCalledWith('loyalty.level_up', expect.objectContaining({
      new_level: 'Oro',
      guest_id:  'guest-001',
    }));
  });

  it('does nothing if guest already has the best level', async () => {
    const statsAlreadyGold = {
      ..._mocks.mockStats,
      current_loyalty_level_id: 'lvl-gold',
      loyalty_level: _mocks.mockGoldLvl,
      update: jest.fn(),
      reload: jest.fn(),
    };
    GuestStats.findOne.mockResolvedValue(statsAlreadyGold);
    LoyaltyLevel.findAll.mockResolvedValue([_mocks.mockGoldLvl]);

    await loyaltyService.recalculateGuestLoyalty('guest-001', 'tenant-001');

    expect(statsAlreadyGold.update).not.toHaveBeenCalled();
    expect(publishEvent).not.toHaveBeenCalled();
  });

  it('returns null when stats not found', async () => {
    GuestStats.findOne.mockResolvedValue(null);
    const result = await loyaltyService.recalculateGuestLoyalty('ghost-id', 'tenant-001');
    expect(result).toBeNull();
  });
});

describe('createLevel()', () => {
  it('creates a new loyalty level', async () => {
    LoyaltyLevel.findOne.mockResolvedValue(null);
    LoyaltyLevel.create.mockResolvedValue({ id: 'lvl-new', name: 'Plata', min_stays: 5 });

    const result = await loyaltyService.createLevel({
      tenant_id: 'tenant-001', name: 'Plata', min_stays: 5, discount_percentage: 0.05,
    });

    expect(LoyaltyLevel.create).toHaveBeenCalledTimes(1);
    expect(result.name).toBe('Plata');
  });

  it('throws LEVEL_EXISTS on duplicate name', async () => {
    LoyaltyLevel.findOne.mockResolvedValue(_mocks.mockLevel);
    await expect(
      loyaltyService.createLevel({ tenant_id: 'tenant-001', name: 'Normal', min_stays: 0, discount_percentage: 0 })
    ).rejects.toMatchObject({ code: 'LEVEL_EXISTS' });
  });
});
