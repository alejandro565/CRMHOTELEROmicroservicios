jest.mock('axios', () => ({
  get: jest.fn(),
}));

jest.mock('../src/models/index', () => {
  const mockStats = [
    { date: '2025-01-10', total_rooms: 20, occupied_rooms: 15, occupancy_percentage: 75.00 },
    { date: '2025-01-11', total_rooms: 20, occupied_rooms: 18, occupancy_percentage: 90.00 },
  ];
  const mockRevenue = [
    { date: '2025-01-10', total_revenue: 4500, adr: 300, revpar: 225, category: 'ROOM' },
    { date: '2025-01-11', total_revenue: 5400, adr: 300, revpar: 270, category: 'ROOM' },
  ];
  return {
    DailyOccupancyStats: {
      findAll: jest.fn().mockResolvedValue(mockStats),
      findOrCreate: jest.fn(),
      upsert: jest.fn(),
    },
    RevenueStats: {
      findAll: jest.fn().mockResolvedValue(mockRevenue),
      upsert: jest.fn(),
    },
    ShiftReport: { upsert: jest.fn() },
    _mocks: { mockStats, mockRevenue },
  };
});

const axios = require('axios');
const { DailyOccupancyStats, RevenueStats, _mocks } = require('../src/models/index');
const reportingService = require('../src/services/reporting.service');

beforeEach(() => jest.clearAllMocks());

describe('generateManagerDashboard()', () => {
  it('aggregates occupancy and revenue data correctly', async () => {
    const result = await reportingService.generateManagerDashboard('tenant-001', {
      from: '2025-01-10', to: '2025-01-11',
    });

    expect(result.summary.total_revenue).toBe(9900);
    expect(result.summary.avg_occupancy_pct).toBe(82.5);
    expect(result.daily_occupancy).toHaveLength(2);
    expect(result.daily_revenue).toHaveLength(2);
  });
});

describe('syncRevenue()', () => {
  it('upserts revenue with ADR and RevPAR calculations', async () => {
    await reportingService.syncRevenue('tenant-001', '2025-01-10', {
      total_revenue: 4500,
      category:      'ROOM',
      total_rooms:   20,
      occupied_rooms: 15,
    });

    expect(RevenueStats.upsert).toHaveBeenCalledWith(expect.objectContaining({
      tenant_id:     'tenant-001',
      date:          '2025-01-10',
      total_revenue: 4500,
      adr:           300,    // 4500 / 15
      revpar:        225,    // 4500 / 20
      category:      'ROOM',
    }));
  });
});

describe('getSalesReport()', () => {
  it('merges projection rows with billing daily payments', async () => {
    axios.get.mockResolvedValue({
      data: {
        daily: [
          { date: '2025-01-10', total_revenue: 5000 },
          { date: '2025-01-12', total_revenue: 1200 },
        ],
      },
    });

    const result = await reportingService.getSalesReport('tenant-001', {
      from: '2025-01-10',
      to: '2025-01-12',
    });

    expect(result.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ date: '2025-01-10', total_revenue: 9500 }),
        expect.objectContaining({ date: '2025-01-11', total_revenue: 5400 }),
        expect.objectContaining({ date: '2025-01-12', total_revenue: 1200 }),
      ])
    );
    expect(result.grand_total).toBe(16100);
  });
});

describe('getLibroDeVentas()', () => {
  it('filters by month range and calculates total', async () => {
    const result = await reportingService.getLibroDeVentas('tenant-001', { year: 2025, month: 1 });

    expect(RevenueStats.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenant_id: 'tenant-001',
          category:  'ROOM',
        }),
      })
    );
    expect(result.total_revenue).toBe(9900);
    expect(result.period.from).toBe('2025-01-01');
    expect(result.period.to).toBe('2025-01-31');
  });
});
