jest.mock('../src/models', () => {
  const mockPermissions = [
    { slug: 'RESERVATIONS_VIEW' },
    { slug: 'BILLING_VIEW' },
  ];
  const mockRole = { id: 'role-001', name: 'TENANT_ADMIN', permissions: mockPermissions };
  const mockTenant = {
    id: 'tenant-001',
    status: 'ACTIVE',
    active_modules: ['CRM', 'BILLING'],
  };
  const mockUser = {
    id: 'user-001',
    email: 'admin@hotel.com',
    full_name: 'Admin User',
    tenant_id: 'tenant-001',
    is_active: true,
    must_change_password: false,
    password_hash: '$2a$12$hash',
    role: mockRole,
    tenant: mockTenant,
    update: jest.fn().mockResolvedValue(true),
  };

  return {
    User: { findOne: jest.fn(), findByPk: jest.fn() },
    RefreshToken: {
      create: jest.fn().mockResolvedValue({ token: 'refresh-uuid' }),
      findOne: jest.fn(),
      update: jest.fn(),
    },
    Role: {},
    Permission: {},
    LocalTenant: {},
    TENANT_STATUS: { ACTIVE: 'ACTIVE', SUSPENDED: 'SUSPENDED', INACTIVE: 'INACTIVE' },
    _mocks: { mockUser, mockRole, mockTenant },
  };
});

jest.mock('bcryptjs', () => ({ compare: jest.fn(), hash: jest.fn() }));
jest.mock('../src/config/jwt', () => ({
  signAccessToken:      jest.fn().mockReturnValue('access-token-xyz'),
  generateRefreshToken: jest.fn().mockReturnValue('refresh-uuid-xyz'),
  refreshTokenExpiresAt: jest.fn().mockReturnValue(new Date('2099-01-01')),
}));

const bcrypt = require('bcryptjs');
const { User, RefreshToken, TENANT_STATUS, _mocks } = require('../src/models');
const authService = require('../src/services/auth.service');

beforeEach(() => jest.clearAllMocks());

describe('login()', () => {
  it('retorna tokens e información de usuario con credenciales válidas', async () => {
    User.findOne.mockResolvedValue(_mocks.mockUser);
    bcrypt.compare.mockResolvedValue(true);

    const result = await authService.login('admin@hotel.com', 'Password1');

    expect(result.success).toBe(true);
    expect(result.accessToken).toBe('access-token-xyz');
    expect(result.user.role).toBe('TENANT_ADMIN');
    expect(result.access.modules).toEqual(['CRM', 'BILLING']);
    expect(_mocks.mockUser.update).toHaveBeenCalledWith({ last_login: expect.any(Date) });
  });

  it('lanza error de credenciales cuando el usuario no existe', async () => {
    User.findOne.mockResolvedValue(null);
    await expect(authService.login('x@x.com', 'pass')).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      status: 401,
    });
  });

  it('lanza error cuando la cuenta del cliente está suspendido', async () => {
    User.findOne.mockResolvedValue({
      ..._mocks.mockUser,
      tenant: { ..._mocks.mockTenant, status: 'SUSPENDED' },
    });
    bcrypt.compare.mockResolvedValue(true);

    await expect(authService.login('admin@hotel.com', 'Password1')).rejects.toMatchObject({
      code: 'TENANT_SUSPENDED',
      status: 403,
    });
  });

  it('lanza INVALID_CREDENTIALS con una contraseña incorrecta', async () => {
    User.findOne.mockResolvedValue(_mocks.mockUser);
    bcrypt.compare.mockResolvedValue(false);

    await expect(authService.login('admin@hotel.com', 'wrong')).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });
});

describe('refresh()', () => {
  it('rota los tokens cuando el token de refresco es válido', async () => {
    const stored = {
      user_id: 'user-001',
      is_revoked: false,
      expires_at: new Date('2099-01-01'),
      update: jest.fn().mockResolvedValue(true),
    };
    RefreshToken.findOne.mockResolvedValue(stored);
    User.findByPk.mockResolvedValue(_mocks.mockUser);

    const result = await authService.refresh('valid-refresh-token');

    expect(stored.update).toHaveBeenCalledWith({ is_revoked: true });
    expect(result.accessToken).toBe('access-token-xyz');
    expect(result.refreshToken).toBe('refresh-uuid-xyz');
  });

  it('lanza INVALID_REFRESH_TOKEN cuando el token no se encuentra', async () => {
    RefreshToken.findOne.mockResolvedValue(null);
    await expect(authService.refresh('bad-token')).rejects.toMatchObject({
      code: 'INVALID_REFRESH_TOKEN',
    });
  });

  it('lanza REFRESH_TOKEN_EXPIRED con un token expirado', async () => {
    const stored = {
      is_revoked: false,
      expires_at: new Date('2000-01-01'), // in the past
      update: jest.fn().mockResolvedValue(true),
    };
    RefreshToken.findOne.mockResolvedValue(stored);
    await expect(authService.refresh('expired-token')).rejects.toMatchObject({
      code: 'REFRESH_TOKEN_EXPIRED',
    });
  });
});
