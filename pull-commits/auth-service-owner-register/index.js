const { Permission, Role, RolePermission } = require('../models');

const SYSTEM_PERMISSIONS = [
  // Reservations
  { module: 'RESERVATIONS', slug: 'RESERVATIONS_VIEW',     description: 'Ver el rack de reservas' },
  { module: 'RESERVATIONS', slug: 'RESERVATIONS_CREATE',   description: 'Crear nuevas reservas' },
  { module: 'RESERVATIONS', slug: 'RESERVATIONS_EDIT',     description: 'Modificar reservas existentes' },
  { module: 'RESERVATIONS', slug: 'RESERVATIONS_CANCEL',   description: 'Cancelar reservas' },
  { module: 'RESERVATIONS', slug: 'RESERVATIONS_CHECKIN',  description: 'Registrar llegada de huésped' },
  { module: 'RESERVATIONS', slug: 'RESERVATIONS_CHECKOUT', description: 'Registrar salida de huésped' },
  // Billing
  { module: 'BILLING', slug: 'BILLING_VIEW',   description: 'Ver folios y consumos' },
  { module: 'BILLING', slug: 'BILLING_PAY',    description: 'Registrar pagos' },
  { module: 'BILLING', slug: 'BILLING_VOID',   description: 'Anular facturas' },
  { module: 'BILLING', slug: 'BILLING_EXPORT', description: 'Exportar reportes de facturación' },
  // CRM
  { module: 'CRM', slug: 'CRM_VIEW',   description: 'Ver perfiles de huéspedes' },
  { module: 'CRM', slug: 'CRM_EDIT',   description: 'Editar datos de huéspedes' },
  { module: 'CRM', slug: 'CRM_DELETE', description: 'Eliminar perfiles' },
  // Housekeeping
  { module: 'HOUSEKEEPING', slug: 'HOUSEKEEPING_VIEW',   description: 'Ver estado de habitaciones' },
  { module: 'HOUSEKEEPING', slug: 'HOUSEKEEPING_UPDATE', description: 'Actualizar estado de limpieza' },
  // Reports
  { module: 'REPORTS', slug: 'REPORTS_VIEW',   description: 'Ver reportes básicos' },
  { module: 'REPORTS', slug: 'REPORTS_EXPORT', description: 'Exportar reportes' },
  // Users (admin only)
  { module: 'USERS', slug: 'USERS_VIEW',   description: 'Ver lista de empleados' },
  { module: 'USERS', slug: 'USERS_MANAGE', description: 'Crear, editar y desactivar empleados' },
  { module: 'USERS', slug: 'USERS_ROLES',  description: 'Gestionar roles y permisos' },
  // Owner — gestión de hoteles propios
  { module: 'OWNER', slug: 'OWNER_CREATE_HOTEL', description: 'Crear un nuevo hotel bajo el plan contratado' },
  { module: 'OWNER', slug: 'OWNER_VIEW_HOTELS',  description: 'Ver la lista de hoteles propios' },
  { module: 'OWNER', slug: 'OWNER_MANAGE_PLAN',  description: 'Ver y cambiar el plan contratado' },
];

const SYSTEM_ROLES = [
  {
    name:           'OWNER',
    description:    'Dueño de la cuenta SaaS. Puede crear y gestionar sus hoteles.',
    is_system_role: true,
    // Owner solo tiene permisos de gestión de cuenta — NO de operación hotelera.
    // Los permisos de operación los obtiene al entrar a un hotel específico (como TENANT_ADMIN).
    permissions: ['OWNER_CREATE_HOTEL', 'OWNER_VIEW_HOTELS', 'OWNER_MANAGE_PLAN'],
  },
  {
    name:           'TENANT_ADMIN',
    description:    'Administrador del hotel. Acceso total a la operación.',
    is_system_role: true,
    permissions:    SYSTEM_PERMISSIONS.filter(p => p.module !== 'OWNER').map(p => p.slug),
  },
  {
    name:           'RECEPTIONIST',
    description:    'Recepcionista. Gestión de reservas y check-in/out.',
    is_system_role: true,
    permissions: [
      'RESERVATIONS_VIEW', 'RESERVATIONS_CREATE', 'RESERVATIONS_EDIT',
      'RESERVATIONS_CHECKIN', 'RESERVATIONS_CHECKOUT',
      'BILLING_VIEW', 'BILLING_PAY',
      'CRM_VIEW', 'CRM_EDIT',
      'HOUSEKEEPING_VIEW',
    ],
  },
  {
    name:           'HOUSEKEEPER',
    description:    'Personal de limpieza.',
    is_system_role: true,
    permissions:    ['HOUSEKEEPING_VIEW', 'HOUSEKEEPING_UPDATE'],
  },
];

async function seedAll() {
  try {
    for (const perm of SYSTEM_PERMISSIONS) {
      await Permission.findOrCreate({ where: { slug: perm.slug }, defaults: perm });
    }
    console.log('[Seeder] permissions ready');

    for (const roleDef of SYSTEM_ROLES) {
      const { permissions: slugs, ...roleFields } = roleDef;

      const [role, created] = await Role.findOrCreate({
        where:    { name: roleFields.name, tenant_id: null },
        defaults: roleFields,
      });

      if (created) {
        const perms   = await Permission.findAll({ where: { slug: slugs } });
        const records = perms.map((p) => ({ role_id: role.id, permission_id: p.id }));
        await RolePermission.bulkCreate(records, { ignoreDuplicates: true });
        console.log(`[Seeder] role "${role.name}" created with ${perms.length} permissions`);
      } else {
        console.log(`[Seeder] role "${role.name}" already exists — skipped`);
      }
    }

    console.log('[Seeder] seed complete');
  } catch (err) {
    console.error('[Seeder] failed:', err.message);
    throw err;
  }
}

module.exports = { seedAll };
