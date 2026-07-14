jest.mock('../src/models', () => {
  const mockShift = {
    id: 'shift-001', tenant_id: 'tenant-001', user_id: 'user-001',
    status: 'OPEN', starting_cash: 200, opened_at: new Date(),
    update: jest.fn().mockResolvedValue(true),
  };
  return {
    CashierShift: { findOne: jest.fn(), create: jest.fn().mockResolvedValue(mockShift) },
    Payment:      { findAll: jest.fn().mockResolvedValue([]) },
    SHIFT_STATUS: { OPEN: 'OPEN', CLOSED: 'CLOSED' },
    _mock: { mockShift },
  };
});

jest.mock('../src/config/rabbitmq', () => ({ publishEvent: jest.fn() }));

const { CashierShift, SHIFT_STATUS, _mock } = require('../src/models');
const { publishEvent } = require('../src/config/rabbitmq');
const shiftService = require('../src/services/shift.service');

beforeEach(() => jest.clearAllMocks());

describe('openShift()', () => {
  it('creates a new shift when none is open', async () => {
    CashierShift.findOne.mockResolvedValue(null);
    const result = await shiftService.openShift('tenant-001', 'user-001', 200);
    expect(CashierShift.create).toHaveBeenCalledWith(expect.objectContaining({ starting_cash: 200, status: SHIFT_STATUS.OPEN }));
  });

  it('throws SHIFT_ALREADY_OPEN if a shift exists', async () => {
    CashierShift.findOne.mockResolvedValue(_mock.mockShift);
    await expect(
      shiftService.openShift('tenant-001', 'user-001', 200)
    ).rejects.toMatchObject({ code: 'SHIFT_ALREADY_OPEN', meta: { shift_id: 'shift-001' } });
  });
});

describe('closeShift()', () => {
  it('calculates difference and publishes SHIFT_CLOSED event', async () => {
    CashierShift.findOne.mockResolvedValue(_mock.mockShift);
    const { Payment } = require('../src/models');
    // Simulate 500 BOB cash payment
    Payment.findAll.mockResolvedValue([{ method: 'CASH', received_currency: 'BOB', received_amount: 500, amount_base: 500 }]);

    await shiftService.closeShift('shift-001', 'tenant-001', 650, 'Turno noche');

    // expected = 200 (starting) + 500 (cash payment) = 700
    // actual = 650 → difference = 50 (shortage)
    expect(_mock.mockShift.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: SHIFT_STATUS.CLOSED, difference: 50 }),
    );
    expect(publishEvent).toHaveBeenCalledWith('billing.shift_closed', expect.objectContaining({ shift_id: 'shift-001' }));
  });

  it('throws SHIFT_ALREADY_CLOSED for closed shifts', async () => {
    CashierShift.findOne.mockResolvedValue({ ..._mock.mockShift, status: 'CLOSED' });
    await expect(
      shiftService.closeShift('shift-001', 'tenant-001', 500)
    ).rejects.toMatchObject({ code: 'SHIFT_ALREADY_CLOSED' });
  });
});
