jest.mock('../src/config/database', () => ({
  sequelize: { transaction: jest.fn().mockResolvedValue({ commit: jest.fn(), rollback: jest.fn() }) },
}));

jest.mock('../src/models', () => {
  const mockMaster = { id: 'folio-master', type: 'MASTER', status: 'OPEN', balance: 500, reservation_id: 'res-001', update: jest.fn().mockResolvedValue(true) };
  const mockIncidental = { id: 'folio-inc', type: 'INCIDENTAL', status: 'OPEN', balance: 0, reservation_id: 'res-001', update: jest.fn().mockResolvedValue(true) };
  return {
    Folio: {
      findOne: jest.fn(),
      findAll: jest.fn(),
      create:  jest.fn(),
      sum:     jest.fn(),
    },
    FolioRoutingRule: { findOne: jest.fn().mockResolvedValue(null), findOrCreate: jest.fn() },
    Charge:  { sum: jest.fn().mockResolvedValue(500) },
    Payment: { sum: jest.fn().mockResolvedValue(0) },
    FOLIO_TYPE:   { MASTER: 'MASTER', INCIDENTAL: 'INCIDENTAL' },
    FOLIO_STATUS: { OPEN: 'OPEN', SETTLED: 'SETTLED', VOIDED: 'VOIDED' },
    CHARGE_CATEGORIES: ['ACCOMMODATION', 'DAMAGE', 'OTHER'],
    _mocks: { mockMaster, mockIncidental },
  };
});

jest.mock('../src/config/rabbitmq', () => ({ publishEvent: jest.fn() }));

const { Folio, FOLIO_TYPE, FOLIO_STATUS, _mocks } = require('../src/models');
const { publishEvent } = require('../src/config/rabbitmq');
const folioService = require('../src/services/folio.service');

beforeEach(() => jest.clearAllMocks());

describe('createFolioSet()', () => {
  it('creates master and incidental folios', async () => {
    Folio.findOne.mockResolvedValue(null); // none exist yet
    Folio.create
      .mockResolvedValueOnce(_mocks.mockMaster)
      .mockResolvedValueOnce(_mocks.mockIncidental);

    const result = await folioService.createFolioSet('tenant-001', 'res-001');

    expect(Folio.create).toHaveBeenCalledTimes(2);
    expect(Folio.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: FOLIO_TYPE.MASTER }),
      expect.anything()
    );
    expect(Folio.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: FOLIO_TYPE.INCIDENTAL }),
      expect.anything()
    );
    expect(result.master.id).toBe('folio-master');
  });

  it('skips creation if folios already exist', async () => {
    Folio.findOne.mockResolvedValue(_mocks.mockMaster);
    const result = await folioService.createFolioSet('tenant-001', 'res-001');
    expect(result).toBeUndefined();
    expect(Folio.create).not.toHaveBeenCalled();
  });
});

describe('updateFolioBalance()', () => {
  it('recalculates balance and publishes FOLIO_CLEARED when balance reaches 0', async () => {
    Folio.findOne.mockResolvedValue(_mocks.mockMaster);
    const { Charge, Payment } = require('../src/models');
    Charge.sum.mockResolvedValue(500);
    Payment.sum.mockResolvedValue(500); // fully paid

    await folioService.updateFolioBalance('folio-master', 'tenant-001');

    expect(_mocks.mockMaster.update).toHaveBeenCalledWith({ balance: 0 }, expect.anything());
    expect(publishEvent).toHaveBeenCalledWith('billing.folio_cleared', expect.objectContaining({ balance: 0 }));
  });

  it('does not publish event when balance remains positive', async () => {
    Folio.findOne.mockResolvedValue(_mocks.mockMaster);
    const { Charge, Payment } = require('../src/models');
    Charge.sum.mockResolvedValue(500);
    Payment.sum.mockResolvedValue(200); // partial payment

    await folioService.updateFolioBalance('folio-master', 'tenant-001');

    expect(_mocks.mockMaster.update).toHaveBeenCalledWith({ balance: 300 }, expect.anything());
    expect(publishEvent).not.toHaveBeenCalled();
  });
});

describe('markFolioSettled()', () => {
  it('throws PENDING_BALANCE when balance > 0', async () => {
    Folio.findOne.mockResolvedValue({ ..._mocks.mockMaster, balance: 200 });
    await expect(
      folioService.markFolioSettled('folio-master', 'tenant-001')
    ).rejects.toMatchObject({ code: 'PENDING_BALANCE', meta: { balance: 200 } });
  });

  it('marks folio as SETTLED when balance is 0', async () => {
    const paidFolio = { ..._mocks.mockMaster, balance: 0, update: jest.fn().mockResolvedValue(true) };
    Folio.findOne.mockResolvedValue(paidFolio);
    await folioService.markFolioSettled('folio-master', 'tenant-001');
    expect(paidFolio.update).toHaveBeenCalledWith({ status: FOLIO_STATUS.SETTLED });
  });
});
