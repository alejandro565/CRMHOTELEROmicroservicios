const { LocalTenant, TENANT_STATUS } = require('./LocalTenant');
const Permission                      = require('./Permission');
const Role                            = require('./Role');
const RolePermission                  = require('./RolePermission');
const User                            = require('./User');
const RefreshToken                    = require('./RefreshToken');
const UserTenant                      = require('./UserTenant');

// Role <-> Permission  (many-to-many through role_permissions)
Role.belongsToMany(Permission, {
  through: RolePermission, foreignKey: 'role_id', otherKey: 'permission_id', as: 'permissions',
});
Permission.belongsToMany(Role, {
  through: RolePermission, foreignKey: 'permission_id', otherKey: 'role_id', as: 'roles',
});

// User -> Role  (rol por defecto / tenant primario)
User.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });
Role.hasMany(User,  { foreignKey: 'role_id', as: 'users' });

// User -> LocalTenant  (tenant primario — se mantiene para compatibilidad)
User.belongsTo(LocalTenant, { foreignKey: 'tenant_id', as: 'tenant' });
LocalTenant.hasMany(User,   { foreignKey: 'tenant_id', as: 'users' });

// RefreshToken -> User
RefreshToken.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(RefreshToken,   { foreignKey: 'user_id', as: 'refreshTokens' });

// ── Multi-hotel ──────────────────────────────────────────────────────────────
// User <-> LocalTenant through UserTenant
User.belongsToMany(LocalTenant, {
  through: UserTenant, foreignKey: 'user_id', otherKey: 'tenant_id', as: 'tenants',
});
LocalTenant.belongsToMany(User, {
  through: UserTenant, foreignKey: 'tenant_id', otherKey: 'user_id', as: 'members',
});

// UserTenant -> Role  (rol especifico para ese hotel)
UserTenant.belongsTo(Role,        { foreignKey: 'role_id',  as: 'role' });
Role.hasMany(UserTenant,          { foreignKey: 'role_id',  as: 'userTenants' });
UserTenant.belongsTo(User,        { foreignKey: 'user_id',  as: 'user' });
UserTenant.belongsTo(LocalTenant, { foreignKey: 'tenant_id', as: 'tenant' });

module.exports = {
  LocalTenant, TENANT_STATUS,
  Permission,
  Role, RolePermission,
  User,
  RefreshToken,
  UserTenant,
};
