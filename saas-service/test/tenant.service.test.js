jest.mock('../src/models', () => {
  const mockPlan = {
    id: 'plan-uuid-001',
    name: 'Premium',
    max_rooms: 100,
    modules: [
      { id: 'CRM', is_active: true },
      { id: 'BILLING', is_active: true },
    ],
  };
  const mockTenant = {
    id: 'tenant-uuid-001',
    plan_id: 'plan-uuid-001',
    name: 'Hotel Paraíso',
    tax_id: '1234567',
    owner_email: 'gerente@hotelparaiso.com',
    status: 'ACTIVE',
    deleted_at: null,
    update: jest.fn().mockResolvedValue(true),
  };

  return {
    Tenant: {
      findOne: jest.fn(),
      findAll: jest.fn(),
      count: jest.fn(),
      create: jest.fn().mockResolvedValue(mockTenant),
      destroy: jest.fn().mockResolvedValue(1),
    },
    Plan: {},
    SystemModule: {},
    TENANT_STATUS: { ACTIVE: 'ACTIVE', SUSPENDED: 'SUSPENDED', INACTIVE: 'INACTIVE' },
    _mockPlan: mockPlan,
    _mockTenant: mockTenant,
  };
});

jest.mock('../src/services/authClient.service');
jest.mock('../src/services/plan.service');
jest.mock('../src/events/publisher');

const { Tenant, TENANT_STATUS, _mockPlan, _mockTenant } = require('../src/models');
const { setupTenantForOwner } = require('../src/services/authClient.service');
const { getActiveModulesForPlan } = require('../src/services/plan.service');
const { publishTenantProvisioned, publishTenantSuspended } = require('../src/events/publisher');
const tenantService = require('../src/services/tenant.service');

beforeEach(() => jest.clearAllMocks());

describe('createHotel', () => {
  const validInput = {
    owner_id: 'owner-uuid-001',
    owner_email: 'gerente@hotelparaiso.com',
    name: 'Hotel Paraíso',
    tax_id: '1234567',
  };

  it('should create tenant and publish event on success', async () => {
    Tenant.findOne.mockResolvedValue(null); // no NIT duplicate
    Tenant.findAll.mockResolvedValue([{ plan: _mockPlan }]);
    Tenant.count.mockResolvedValue(1);
    getActiveModulesForPlan.mockResolvedValue({
      plan: _mockPlan,
      active_modules: ['CRM', 'BILLING'],
    });
    setupTenantForOwner.mockResolvedValue({ success: true });

    const result = await tenantService.createHotel(validInput);

    expect(Tenant.create).toHaveBeenCalledTimes(1);
    expect(setupTenantForOwner).toHaveBeenCalledTimes(1);
    expect(publishTenantProvisioned).toHaveBeenCalledTimes(1);
    expect(result.tenant_id).toBe(_mockTenant.id);
    expect(result.plan.modules).toEqual(['CRM', 'BILLING']);
  });

  it('should throw TAX_ID_DUPLICATE if NIT already exists', async () => {
    Tenant.findOne.mockResolvedValue(_mockTenant);

    await expect(tenantService.createHotel(validInput)).rejects.toMatchObject({
      code: 'TAX_ID_DUPLICATE',
      status: 409,
    });
    expect(Tenant.create).not.toHaveBeenCalled();
  });

  it('should rollback tenant if auth-service fails', async () => {
    Tenant.findOne.mockResolvedValue(null);
    Tenant.findAll.mockResolvedValue([{ plan: _mockPlan }]);
    Tenant.count.mockResolvedValue(1);
    getActiveModulesForPlan.mockResolvedValue({
      plan: _mockPlan,
      active_modules: ['CRM'],
    });
    setupTenantForOwner.mockRejectedValue({ code: 'EMAIL_IN_USE', status: 409 });

    await expect(tenantService.createHotel(validInput)).rejects.toBeDefined();
    expect(Tenant.destroy).toHaveBeenCalledWith({ where: { id: _mockTenant.id } });
    expect(publishTenantProvisioned).not.toHaveBeenCalled();
  });
});

describe('suspendHotel', () => {
  it('should update status and publish event', async () => {
    Tenant.findOne.mockResolvedValue({ ..._mockTenant, status: 'ACTIVE' });

    await tenantService.suspendHotel('tenant-uuid-001', 'Pago vencido');

    expect(_mockTenant.update).toHaveBeenCalledWith({ status: TENANT_STATUS.SUSPENDED });
    expect(publishTenantSuspended).toHaveBeenCalledWith({
      tenant_id: 'tenant-uuid-001',
      reason: 'Pago vencido',
    });
  });

  it('should throw ALREADY_SUSPENDED if tenant is already suspended', async () => {
    Tenant.findOne.mockResolvedValue({ ..._mockTenant, status: 'SUSPENDED' });

    await expect(tenantService.suspendHotel('tenant-uuid-001')).rejects.toMatchObject({
      code: 'ALREADY_SUSPENDED',
    });
  });
});
