jest.mock('../src/models', () => ({
  AvailabilityBlock: {
    findAll:       jest.fn(),
    findOrCreate:  jest.fn(),
    increment:     jest.fn().mockResolvedValue(true),
  },
}));

const { AvailabilityBlock } = require('../src/models');
const { checkAvailability, blockDates, _dateRange } = require('../src/services/availability.service');

beforeEach(() => jest.clearAllMocks());

describe('_dateRange()', () => {
  it('generates correct night count (excludes check_out_date)', () => {
    const dates = _dateRange('2025-01-10', '2025-01-13');
    expect(dates).toEqual(['2025-01-10', '2025-01-11', '2025-01-12']);
    expect(dates).toHaveLength(3);
  });

  it('returns empty array when check_in equals check_out', () => {
    expect(_dateRange('2025-01-10', '2025-01-10')).toHaveLength(0);
  });
});

describe('checkAvailability()', () => {
  it('returns available=true when all nights have count > 0', async () => {
    AvailabilityBlock.findAll.mockResolvedValue([
      { date: '2025-01-10', available_count: 5 },
      { date: '2025-01-11', available_count: 3 },
    ]);

    const result = await checkAvailability('tenant-001', 'rt-001', '2025-01-10', '2025-01-12');
    expect(result.available).toBe(true);
    expect(result.nights).toBe(2);
  });

  it('returns available=false with specific blocked dates', async () => {
    AvailabilityBlock.findAll.mockResolvedValue([
      { date: '2025-01-10', available_count: 2 },
      { date: '2025-01-11', available_count: 0 }, // blocked
    ]);

    const result = await checkAvailability('tenant-001', 'rt-001', '2025-01-10', '2025-01-12');
    expect(result.available).toBe(false);
    expect(result.unavailable_dates).toContain('2025-01-11');
  });

  it('treats missing blocks as available (hotel not yet initialized)', async () => {
    AvailabilityBlock.findAll.mockResolvedValue([]); // no blocks = treat as available

    const result = await checkAvailability('tenant-001', 'rt-001', '2025-01-10', '2025-01-12');
    expect(result.available).toBe(true);
  });

  it('throws INVALID_DATE_RANGE when check_in >= check_out', async () => {
    await expect(
      checkAvailability('tenant-001', 'rt-001', '2025-01-15', '2025-01-10')
    ).rejects.toMatchObject({ code: 'INVALID_DATE_RANGE' });
  });
});
