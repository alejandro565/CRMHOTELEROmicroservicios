jest.mock('../src/models/index', () => {
  const mockLog = { id: 'log-001', tenant_id: 'tenant-001', action: 'VOID', user_id: 'user-001', occurred_at: new Date() };
  return {
    ActivityLog: {
      create:       jest.fn().mockResolvedValue(mockLog),
      findAndCountAll: jest.fn().mockResolvedValue({ count: 1, rows: [mockLog] }),
      findAll:      jest.fn(),
      sequelize:    { fn: jest.fn(), col: jest.fn(), literal: jest.fn() },
    },
    DataDiff: { create: jest.fn().mockResolvedValue({}) },
    _mock: { mockLog },
  };
});

const { ActivityLog, DataDiff, _mock } = require('../src/models/index');
const auditService = require('../src/services/audit.service');

beforeEach(() => jest.clearAllMocks());

describe('ingestLog()', () => {
  it('crea un registro de actividad con diferencias (diff) cuando el payload tiene estados anteriores y posteriores', async () => {
    const result = await auditService.ingestLog({
      tenant_id: 'tenant-001', user_id: 'user-001',
      action: 'UPDATE', module: 'BILLING', entity_id: 'folio-001',
      payload: { before: { amount: 500 }, after: { amount: 450 } },
    });

    expect(ActivityLog.create).toHaveBeenCalledTimes(1);
    expect(DataDiff.create).toHaveBeenCalledWith(expect.objectContaining({
      log_id:         'log-001',
      previous_state: { amount: 500 },
      new_state:      { amount: 450 },
    }));
    expect(result.id).toBe('log-001');
  });

  it('crea un registro de actividad sin diferencias cuando no se envían estados anteriores ni posteriores', async () => {
    await auditService.ingestLog({
      tenant_id: 'tenant-001', user_id: 'user-001',
      action: 'LOGIN', module: 'AUTH',
    });
    expect(ActivityLog.create).toHaveBeenCalledTimes(1);
    expect(DataDiff.create).not.toHaveBeenCalled();
  });

  it('retorna null y muestra una advertencia cuando falta el campo "action"', async () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await auditService.ingestLog({ tenant_id: 'tenant-001', module: 'BILLING' });
    expect(result).toBeNull();
    expect(ActivityLog.create).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('getAuditByEntity()', () => {
  it('retorna los registros paginados para una entidad específica', async () => {
    const result = await auditService.getAuditByEntity('folio-001', 'tenant-001');
    expect(ActivityLog.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { entity_id: 'folio-001', tenant_id: 'tenant-001' } })
    );
    expect(result.total).toBe(1);
    expect(result.data[0].id).toBe('log-001');
  });
});
