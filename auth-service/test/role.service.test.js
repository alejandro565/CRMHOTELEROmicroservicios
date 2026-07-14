jest.mock('../src/models', () => {
  const mockPerms = [
    { id: 'p-1', slug: 'RESERVATIONS_VIEW' },
    { id: 'p-2', slug: 'BILLING_VIEW' },
  ];
  const mockRole = {
    id: 'role-001',
    name: 'Recepcionista',
    tenant_id: 'tenant-001',
    is_system_role: false,
    destroy: jest.fn().mockResolvedValue(true),
    update: jest.fn().mockResolvedValue(true),
  };

  const mockTransaction = {
    commit: jest.fn(),
    rollback: jest.fn(),
  };

  return {
    Role: {
      findOne: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn().mockResolvedValue(mockRole),
      sequelize: { transaction: jest.fn().mockResolvedValue(mockTransaction) },
    },
    Permission: { findAll: jest.fn().mockResolvedValue(mockPerms) },
    RolePermission: {
      destroy: jest.fn().mockResolvedValue(1),
      bulkCreate: jest.fn().mockResolvedValue([]),
    },
    User: { count: jest.fn().mockResolvedValue(0) },
    _mocks: { mockRole, mockPerms, mockTransaction },
  };
});

jest.mock('../src/config/rabbitmq', () => ({ publishEvent: jest.fn() }));

const { Role, User, _mocks } = require('../src/models');
const roleService = require('../src/services/role.service');

beforeEach(() => jest.clearAllMocks());

describe('createRole()', () => {
  it('crea un rol y vincula los permisos correctamente', async () => {
    Role.findOne.mockResolvedValue(null); // no duplicate
    const result = await roleService.createRole({
      name: 'Recepcionista',
      description: 'Rol de recepción',
      permission_slugs: ['RESERVATIONS_VIEW', 'BILLING_VIEW'],
      tenant_id: 'tenant-001',
    });

    expect(Role.create).toHaveBeenCalledTimes(1);
    expect(result.assigned_permissions).toBe(2);
    expect(_mocks.mockTransaction.commit).toHaveBeenCalled();
  });

  it('lanza ROLE_NAME_EXISTS si el nombre ya está en uso', async () => {
    Role.findOne.mockResolvedValue(_mocks.mockRole);
    await expect(
      roleService.createRole({ name: 'Recepcionista', tenant_id: 'tenant-001' })
    ).rejects.toMatchObject({ code: 'ROLE_NAME_EXISTS' });
  });
});

describe('deleteRole()', () => {
  it('elimina un rol que no tiene usuarios activos', async () => {
    Role.findOne.mockResolvedValue(_mocks.mockRole);
    User.count.mockResolvedValue(0);

    const result = await roleService.deleteRole('role-001', 'tenant-001');
    expect(_mocks.mockRole.destroy).toHaveBeenCalled();
    expect(result.deleted).toBe(true);
  });

  it('lanza ROLE_HAS_ACTIVE_USERS cuando hay usuarios asignados al rol', async () => {
    Role.findOne.mockResolvedValue(_mocks.mockRole);
    User.count.mockResolvedValue(3);

    await expect(
      roleService.deleteRole('role-001', 'tenant-001')
    ).rejects.toMatchObject({ code: 'ROLE_HAS_ACTIVE_USERS', meta: { active_users: 3 } });
  });

  it('lanza SYSTEM_ROLE_PROTECTED para roles que son del sistema', async () => {
    Role.findOne.mockResolvedValue({ ..._mocks.mockRole, is_system_role: true });

    await expect(
      roleService.deleteRole('role-001', 'tenant-001')
    ).rejects.toMatchObject({ code: 'SYSTEM_ROLE_PROTECTED' });
  });
});
