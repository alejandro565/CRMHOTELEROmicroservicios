export const ROUTE_ACCESS = {
  '/dashboard': ['REPORTS_OPERATIONAL', 'REPORTS_FINANCIAL'],
  '/active-stays': ['RESERVATIONS_VIEW'],
  '/reservations': ['RESERVATIONS_VIEW'],
  '/frontdesk/calendar': ['RESERVATIONS_VIEW'],
  '/rooms': ['HOTELS_VIEW'],
  '/room-types': ['HOTELS_CONFIG'],
  '/guests': ['GUESTS_VIEW'],
  '/companies': ['GUESTS_VIEW'],
  '/loyalty': ['LOYALTY_MANAGE'],
  '/billing': ['BILLING_VIEW'],
  '/shifts': ['BILLING_CASHIER'],
  '/invoices': ['BILLING_INVOICE'],
  '/users': ['USERS_VIEW'],
  '/roles': ['ROLES_MANAGE', 'USERS_ROLES'],
  '/plans': ['OWNER_MANAGE_PLAN'],
  '/audit': ['AUDIT_VIEW'],
  '/infrastructure': ['AUDIT_VIEW'],
  '/reports': ['REPORTS_OPERATIONAL', 'REPORTS_FINANCIAL'],
  '/hotel-settings': [
    'HOTELS_CONFIG',
    'USERS_VIEW',
    'USERS_MANAGE',
    'ROLES_MANAGE',
    'USERS_ROLES',
    'EXCHANGE_MANAGE',
    'INVENTORY_MANAGE',
  ],
};

export const DEFAULT_ROUTE_ORDER = [
  '/dashboard',
  '/active-stays',
  '/reservations',
  '/frontdesk/calendar',
  '/rooms',
  '/guests',
  '/companies',
  '/loyalty',
  '/billing',
  '/invoices',
  '/reports',
  '/hotel-settings',
  '/audit',
  '/plans',
];

export function normalizePermissions(user) {
  return (user?.permissions || user?.perms || [])
    .map((permission) => {
      if (typeof permission === 'string') return permission;
      return permission?.slug || permission?.name || permission?.permission;
    })
    .filter(Boolean);
}

export function hasAnyPermission(user, permissions = []) {
  if (!permissions.length) return true;
  const userPermissions = normalizePermissions(user);
  return permissions.some((permission) => userPermissions.includes(permission));
}

export function canAccessPath(user, path) {
  return hasAnyPermission(user, ROUTE_ACCESS[path] || []);
}

export function getDefaultPath(user) {
  return DEFAULT_ROUTE_ORDER.find((path) => canAccessPath(user, path)) || '/403';
}
