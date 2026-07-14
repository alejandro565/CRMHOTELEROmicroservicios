const { Permission, Role, RolePermission } = require('../models');

console.log('[Seeder] Starting execution...');

// ─── Permissions catalog ───────────────────────────────────────────────────────
const SYSTEM_PERMISSIONS = [
  // --- Módulo: SAAS (Gestión Global del Sistema) ---
  { module: 'SAAS', slug: 'SYSTEM_TENANT_MANAGE', description: 'Administrar hoteles (activar/suspender/planes)' },

  // --- Módulo: AUTH (Gestión de Personal) ---
  { module: 'AUTH', slug: 'USERS_VIEW',          description: 'Ver lista de empleados del hotel' },
  { module: 'AUTH', slug: 'USERS_MANAGE',        description: 'Crear, editar y desactivar empleados' },
  { module: 'AUTH', slug: 'ROLES_MANAGE',        description: 'Gestionar roles y permisos del hotel' },

  // --- Módulo: HOTELS (Infraestructura e Inventario Físico) ---
  { module: 'HOTELS', slug: 'HOTELS_VIEW',         description: 'Ver configuración y estado de habitaciones' },
  { module: 'HOTELS', slug: 'HOTELS_CONFIG',       description: 'Configurar pisos, tipos de cuarto y habitaciones' },
  { module: 'HOTELS', slug: 'HOUSEKEEPING_UPDATE', description: 'Actualizar estados de limpieza (Limpia/Sucia)' },
  { module: 'HOTELS', slug: 'MAINTENANCE_MANAGE',  description: 'Reportar daños y gestionar reparaciones' },
  { module: 'HOTELS', slug: 'MAINTENANCE_WRITE',        description: 'Reportar daños y gestionar reparaciones' },
  { module: 'HOTELS', slug: 'INVENTORY_MANAGE',    description: 'Gestionar catálogo de objetos prestables y stock' },

  // --- Módulo: GUESTS (CRM y Lealtad) ---
  { module: 'GUESTS', slug: 'GUESTS_VIEW',         description: 'Ver perfiles de huéspedes e historial' },
  { module: 'GUESTS', slug: 'GUESTS_CREATE',       description: 'Registrar nuevos huéspedes' },
  { module: 'GUESTS', slug: 'GUESTS_UPDATE',       description: 'Editar datos de huéspedes y preferencias' },
  { module: 'GUESTS', slug: 'GUESTS_MERGE',        description: 'Unificar perfiles duplicados' },
  { module: 'GUESTS', slug: 'LOYALTY_MANAGE',      description: 'Configurar niveles de lealtad y descuentos' },

  // --- Módulo: RESERVATIONS (Operación de Reservas) ---
  { module: 'RESERVATIONS', slug: 'RESERVATIONS_VIEW',    description: 'Ver el rack y calendario de reservas' },
  { module: 'RESERVATIONS', slug: 'RESERVATIONS_CREATE',  description: 'Crear nuevas reservas y walk-ins' },
  { module: 'RESERVATIONS', slug: 'RESERVATIONS_EDIT',    description: 'Modificar fechas, precios o extender estadías' },
  { module: 'RESERVATIONS', slug: 'RESERVATIONS_STATUS',  description: 'Cancelar reservas o marcar No-Show' },
  { module: 'RESERVATIONS', slug: 'RESERVATIONS_RELOCATE',description: 'Reubicar huésped de habitación física' },
  { module: 'RESERVATIONS', slug: 'RESERVATIONS_CHECKIN', description: 'Realizar proceso de Check-in' },
  { module: 'RESERVATIONS', slug: 'RESERVATIONS_CHECKOUT',description: 'Realizar proceso de Check-out' },
  { module: 'RESERVATIONS', slug: 'LOANS_MANAGE',         description: 'Gestionar préstamos de objetos a huéspedes' },
  { module: 'RESERVATIONS', slug: 'CHECKIN_EXECUTE',      description: 'Ejecutar proceso de Check-in' },
  { module: 'RESERVATIONS', slug: 'CHECKOUT_EXECUTE',     description: 'Ejecutar proceso de Check-out' },

  // --- Módulo: BILLING (Finanzas y Cajas) ---
  { module: 'BILLING', slug: 'BILLING',           description: 'Permiso provisional sera editado despues' },
  { module: 'BILLING', slug: 'BILLING_VIEW',      description: 'Ver folios, consumos y estados de cuenta' },
  { module: 'BILLING', slug: 'BILLING_ADD_CHARGE',description: 'Cargar consumos (frigobar, extras) a la cuenta' },
  { module: 'BILLING', slug: 'BILLING_PAY',       description: 'Registrar cobros en diversas monedas' },
  { module: 'BILLING', slug: 'BILLING_ADJUST',    description: 'Autorizar descuentos y regateos comercial' },
  { module: 'BILLING', slug: 'BILLING_VOID',      description: 'Anular cargos o facturas' },
  { module: 'BILLING', slug: 'BILLING_INVOICE',   description: 'Emitir facturas fiscales (SIN)' },
  { module: 'BILLING', slug: 'BILLING_CASHIER',   description: 'Abrir y cerrar turnos de caja (Arqueos)' },
  { module: 'BILLING', slug: 'EXCHANGE_MANAGE',   description: 'Gestionar la tasa de cambio del día' },

  // --- Módulo: AUDIT & REPORTING (Análisis y Control) ---
  { module: 'AUDIT', slug: 'AUDIT_VIEW',          description: 'Ver logs de auditoría (quién hizo qué)' },
  { module: 'REPORTS', slug: 'REPORTS_OPERATIONAL',description: 'Ver reportes de ocupación y limpieza' },
  { module: 'REPORTS', slug: 'REPORTS_FINANCIAL',  description: 'Ver reportes de ingresos y KPIs gerenciales' },

  // Owner — gestión de hoteles propios
  { module: 'OWNER', slug: 'OWNER_CREATE_HOTEL', description: 'Crear un nuevo hotel bajo el plan contratado' },
  { module: 'OWNER', slug: 'OWNER_VIEW_HOTELS',  description: 'Ver la lista de hoteles propios' },
  { module: 'OWNER', slug: 'OWNER_MANAGE_PLAN',  description: 'Ver y cambiar el plan contratado' },
  { module: 'OWNER', slug: 'OWNER_DELETE_HOTEL', description: 'Eliminar hotel' },
];

// ─── System roles with their default permission slugs ─────────────────────────
const SYSTEM_ROLES = [
  {
    name:           'OWNER',
    description:    'Dueño de la cuenta SaaS. Puede crear y gestionar sus hoteles.',
    is_system_role: true,
    // Owner es el "Super Admin" del cliente. Tiene acceso a todo lo operativo + lo propio del dueño.
    permissions: SYSTEM_PERMISSIONS.filter(p => p.module !== 'SAAS').map(p => p.slug),
  },
  {
    name: 'TENANT_ADMIN',
    description: 'Gerente del Hotel. Acceso total a la operación y configuración.',
    is_system_role: true,
    // El Admin tiene TODO excepto permisos de nivel SAAS (que son para ti)
    permissions: SYSTEM_PERMISSIONS.filter(p => p.module !== 'SAAS').map(p => p.slug),
  },
  {
    name: 'RECEPTIONIST',
    description: 'Personal de recepción. Operación diaria.',
    is_system_role: true,
    permissions: [
      'HOTELS_VIEW', 'HOUSEKEEPING_UPDATE',
      'GUESTS_VIEW', 'GUESTS_CREATE', 'GUESTS_UPDATE',
      'RESERVATIONS_VIEW', 'RESERVATIONS_CREATE', 'RESERVATIONS_EDIT', 'RESERVATIONS_CHECKIN', 'RESERVATIONS_CHECKOUT', 'LOANS_MANAGE',
      'BILLING_VIEW', 'BILLING_ADD_CHARGE', 'BILLING_PAY', 'BILLING_INVOICE', 'BILLING_CASHIER'
    ],
  },
  {
    name: 'HOUSEKEEPER',
    description: 'Personal de limpieza y mantenimiento.',
    is_system_role: true,
    permissions: ['HOTELS_VIEW', 'HOUSEKEEPING_UPDATE', 'MAINTENANCE_MANAGE'],
  },
  {
    name: 'AUDITOR',
    description: 'Contador o Auditor. Solo lectura de datos financieros y de seguridad.',
    is_system_role: true,
    permissions: ['BILLING_VIEW', 'AUDIT_VIEW', 'REPORTS_OPERATIONAL', 'REPORTS_FINANCIAL'],
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

      const [role] = await Role.findOrCreate({
        where:    { name: roleFields.name, tenant_id: null },
        defaults: roleFields,
      });

      // Sincronizar permisos dictaminados por el código (ideal para reiniciar permisos)
      const perms   = await Permission.findAll({ where: { slug: slugs } });
      
      // Eliminamos los permisos anteriores de este rol de sistema
      await RolePermission.destroy({ where: { role_id: role.id } });
      
      // Insertamos la lista maestra fresca
      const records = perms.map((p) => ({ role_id: role.id, permission_id: p.id }));
      await RolePermission.bulkCreate(records);
      
      console.log(`[Seeder] role "${role.name}" synchronized with ${perms.length} permissions`);
    }

    console.log('[Seeder] seed complete');
  } catch (err) {
    console.error('[Seeder] failed:', err.message);
    throw err;
  }
}

module.exports = { seedAll };

if (require.main === module) {
  require('dotenv').config();
  seedAll()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}