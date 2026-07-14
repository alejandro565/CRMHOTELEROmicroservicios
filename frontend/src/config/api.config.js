/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║              HOTEL CRM — SERVICE ROUTER CONFIG               ║
 * ║                                                              ║
 * ║  En desarrollo Vite proxea cada prefijo al puerto correcto.  ║
 * ║  En producción apuntan al API Gateway nginx en el mismo host.║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Para cambiar de entorno: edita VITE_ENV en .env
 *   VITE_ENV=production   → todas las rutas van a /saas/, /auth-api/, etc.
 *   VITE_ENV=development  → Vite proxy reescribe al puerto correcto
 */

const ENV = import.meta.env.VITE_ENV || 'development'

// En producción nginx strippea el prefijo antes de llegar al servicio.
// En desarrollo el proxy de Vite hace lo mismo localmente.
const BASE = {
  development: {
    saas:        '/saas',
    auth:        '/auth',
    hotels:      '/hotels',
    guest:       '/guests',
    reservation: '/reservation',
    billing:     '/billing',
    audit:       '/audit',
    reporting:   '/reporting',
  },
  production: {
    // Mismo nginx, mismo host — solo cambian los prefijos
    saas:        '/saas',
    auth:        '/auth',
    hotels:      '/hotels',
    guest:       '/guests',
    reservation: '/reservation',
    billing:     '/billing',
    audit:       '/audit',
    reporting:   '/reporting',
  },
  // Staging con dominio propio (opcional)
  staging: {
    saas:        'https://staging.hotelcrm.com/saas',
    auth:        'https://staging.hotelcrm.com/auth',
    hotels:      'https://staging.hotelcrm.com/hotels',
    guest:       'https://staging.hotelcrm.com/guests',
    reservation: 'https://staging.hotelcrm.com/reservation',
    billing:     'https://staging.hotelcrm.com/billing',
    audit:       'https://staging.hotelcrm.com/audit',
    reporting:   'https://staging.hotelcrm.com/reporting',
  },
}

export const SERVICES = BASE[ENV] || BASE.development

// ─── Endpoints ────────────────────────────────────────────────────────────────

export const ENDPOINTS = {
  auth: {
    login:           () => `${SERVICES.auth}/login`,
    logout:          () => `${SERVICES.auth}/logout`,
    registerOwner:   () => `${SERVICES.auth}/register-owner`,
    switchTenant:    () => `${SERVICES.auth}/switch-tenant`,
    refresh:         () => `${SERVICES.auth}/refresh`,
    changePassword:  () => `${SERVICES.auth}/change-password`,
    listUsers:       () => `${SERVICES.auth}/users`,
    createUser:      () => `${SERVICES.auth}/users`,
    updateUserRole:  (id) => `${SERVICES.auth}/users/${id}/role`,
    toggleUser:      (id) => `${SERVICES.auth}/users/${id}/active`,
    updateUserSchedule:(id) => `${SERVICES.auth}/users/${id}/schedule`,
    listRoles:       () => `${SERVICES.auth}/roles`,
    createRole:      () => `${SERVICES.auth}/roles`,
    updateRole:      (id) => `${SERVICES.auth}/roles/${id}`,
    deleteRole:      (id) => `${SERVICES.auth}/roles/${id}`,
    reassignPerms:   (id) => `${SERVICES.auth}/roles/${id}/permissions`,
    listPermissions: () => `${SERVICES.auth}/permissions`,
  },

  saas: {
    listPlans:     () => `${SERVICES.saas}/plans`,
    createPlan:    () => `${SERVICES.saas}/plans`,
    listModules:   () => `${SERVICES.saas}/modules`,
    createModule:  () => `${SERVICES.saas}/modules`,
    listTenants:   () => `${SERVICES.saas}/tenants`,
    myHotels:      () => `${SERVICES.saas}/tenants/mine`,
    createTenant:  () => `${SERVICES.saas}/tenants`,
    updateTenant:  (id) => `${SERVICES.saas}/tenants/${id}`,
    createFirstTenant: () => `${SERVICES.saas}/tenants/first`,
    getTenant:     (id) => `${SERVICES.saas}/tenants/${id}`,
    suspendTenant: (id) => `${SERVICES.saas}/tenants/${id}/suspend`,
    reactivate:    (id) => `${SERVICES.saas}/tenants/${id}/reactivate`,
    changePlan:    (id) => `${SERVICES.saas}/tenants/${id}/plan`,
    deleteTenant:  (id) => `${SERVICES.saas}/tenants/${id}`,
  },

  hotels: {
    getSettings:     () => `${SERVICES.hotels}/settings`,
    updateSettings:  () => `${SERVICES.hotels}/settings`,
    listRoomTypes:   () => `${SERVICES.hotels}/room-types`,
    createRoomType:  () => `${SERVICES.hotels}/room-types`,
    updateRoomType:  (id) => `${SERVICES.hotels}/room-types/${id}`,
    deleteRoomType:  (id) => `${SERVICES.hotels}/room-types/${id}`,
    amenities:       () => `${SERVICES.hotels}/amenities`,
    beds:            () => `${SERVICES.hotels}/bed-types`,
    onboardingSeed:  () => `${SERVICES.hotels}/onboarding/seed`,
    listRooms:       (qs) => `${SERVICES.hotels}/rooms${qs ? '?' + qs : ''}`,
    createRoom:      () => `${SERVICES.hotels}/rooms`,
    massCreateRooms: () => `${SERVICES.hotels}/rooms/mass`,
    updateRoom:      (id) => `${SERVICES.hotels}/rooms/${id}`,
    deleteRoom:      (id) => `${SERVICES.hotels}/rooms/${id}`,
    changeRoomStatus:(id) => `${SERVICES.hotels}/rooms/${id}/status`,
    hkRack:          () => `${SERVICES.hotels}/housekeeping/rack`,
    hkPending:       () => `${SERVICES.hotels}/housekeeping/pending`,
    listIncidents:   () => `${SERVICES.hotels}/maintenance/incidents`,
    reportDamage:    () => `${SERVICES.hotels}/maintenance/incidents`,
    closeIncident:   (id) => `${SERVICES.hotels}/maintenance/incidents/${id}/close`,
    listItems:       () => `${SERVICES.hotels}/lendable-items`,
    createItem:      () => `${SERVICES.hotels}/lendable-items`,
    adjustInventory: (itemId) => `${SERVICES.hotels}/inventory/${itemId}/adjust`,
  },

  guest: {
    listGuests:    (qs) => `${SERVICES.guest}/guests${qs ? '?' + qs : ''}`,
    createGuest:   () => `${SERVICES.guest}/guests`,
    getGuest:      (id) => `${SERVICES.guest}/guests/${id}`,
    updateGuest:   (id) => `${SERVICES.guest}/guests/${id}`,
    searchGuest:   (qs) => `${SERVICES.guest}/guests/search?${qs}`,
    mergeGuests:   (id) => `${SERVICES.guest}/guests/${id}/merge`,
    addDocument:   (id) => `${SERVICES.guest}/guests/${id}/documents`,
    listLevels:    () => `${SERVICES.guest}/loyalty/levels`,
    createLevel:   () => `${SERVICES.guest}/loyalty/levels`,
    updateLevel:   (id) => `${SERVICES.guest}/loyalty/levels/${id}`,
    deleteLevel:   (id) => `${SERVICES.guest}/loyalty/levels/${id}`,
    listCompanies: () => `${SERVICES.guest}/companies`,
    createCompany: () => `${SERVICES.guest}/companies`,
    updateCompany: (id) => `${SERVICES.guest}/companies/${id}`,
  },

  reservation: {
    root:              SERVICES.reservation,
    checkAvailability: (qs) => `${SERVICES.reservation}/availability?${qs}`,
    checkAvailabilityAll: (qs) => `${SERVICES.reservation}/availability/all?${qs}`,
    physicalRooms:     (qs) => `${SERVICES.reservation}/availability/physical-rooms?${qs}`,
    listReservations:  (qs) => `${SERVICES.reservation}/reservations${qs ? '?' + qs : ''}`,
    getReservation:    (id) => `${SERVICES.reservation}/reservations/${id}`,
    createReservation: () => `${SERVICES.reservation}/reservations`,
    editReservation:   (id) => `${SERVICES.reservation}/reservations/${id}`,
    cancel:            (id) => `${SERVICES.reservation}/reservations/${id}/cancel`,
    noShow:            (id) => `${SERVICES.reservation}/reservations/${id}/noshow`,
    extendStay:        (resRoomId) => `${SERVICES.reservation}/reservations/rooms/${resRoomId}/extend`,
    assignRoom:        (resRoomId) => `${SERVICES.reservation}/front-office/rooms/${resRoomId}/assign`,
    relocate:          (resRoomId) => `${SERVICES.reservation}/front-office/rooms/${resRoomId}/relocate`,
    checkIn:           (id) => `${SERVICES.reservation}/front-office/${id}/checkin`,
    checkOut:          (id) => `${SERVICES.reservation}/front-office/${id}/checkout`,
    genPortalToken:    (id) => `${SERVICES.reservation}/portal/generate/${id}`,
    changeResponsible: (id) => `${SERVICES.reservation}/reservations/${id}/change-responsible`,
    updateFinances:    (id) => `${SERVICES.reservation}/reservations/${id}/finances`,
    addGuest:          (resRoomId) => `${SERVICES.reservation}/reservations/rooms/${resRoomId}/guests`,
    addGuestToReservation: (id) => `${SERVICES.reservation}/reservations/${id}/guests`,
    removeGuest:       (guestResId) => `${SERVICES.reservation}/reservations/guests/${guestResId}`,
    updateGuestData:   (guestResId) => `${SERVICES.reservation}/reservations/guests/${guestResId}`,
    notifyPortal:      (id) => `${SERVICES.reservation}/reservations/${id}/notify`,
    listLoans:         (resRoomId) => `${SERVICES.reservation}/loans/${resRoomId}`,
    lendItem:          () => `${SERVICES.reservation}/loans`,
    returnItem:        (loanId) => `${SERVICES.reservation}/loans/${loanId}/return`,
    returnLoan:        (id) => `${SERVICES.reservation}/loans/${id}/return`,
    markLost:          (id) => `${SERVICES.reservation}/loans/${id}/lost`,
    assignPhysicalRoom: (resRoomId) => `${SERVICES.reservation}/reservations/rooms/${resRoomId}/assign-physical`,
    assignGuestToRoom:  (guestResId) => `${SERVICES.reservation}/reservations/guests/${guestResId}/assign`,
  },

  billing: {
    openShift:    () => `${SERVICES.billing}/shifts/open`,
    currentShift: () => `${SERVICES.billing}/shifts/current-status`,
    closeShift:   (id) => `${SERVICES.billing}/shifts/${id}/close`,
    foliosByRes:  (resId) => `${SERVICES.billing}/folios/reservation/${resId}`,
    getFolio:     (id) => `${SERVICES.billing}/folios/${id}`,
    settleFolio:  (id) => `${SERVICES.billing}/folios/${id}/settle`,
    routeCharge:  (id) => `${SERVICES.billing}/folios/${id}/route`,
    addCharge:    () => `${SERVICES.billing}/charges`,
    listCharges:  (folioId) => `${SERVICES.billing}/charges/${folioId}`,
    voidCharge:   (id) => `${SERVICES.billing}/charges/${id}/void`,
    addPayment:   (folioId) => `${SERVICES.billing}/payments/${folioId}`,
    listPayments: (folioId) => `${SERVICES.billing}/payments/${folioId}`,
    voidPayment:  (id) => `${SERVICES.billing}/payments/${id}/void`,
    listRates:    () => `${SERVICES.billing}/exchange-rates`,
    setRate:      () => `${SERVICES.billing}/exchange-rates`,
    genInvoice:   (folioId) => `${SERVICES.billing}/invoices/${folioId}`,
    listInvoices: () => `${SERVICES.billing}/invoices`,
    listAllFolios:(qs) => `${SERVICES.billing}/folios${qs ? '?' + qs : ''}`,
    listAllPayments:(qs) => `${SERVICES.billing}/payments${qs ? '?' + qs : ''}`,
  },

  audit: {
    all:       (qs) => `${SERVICES.audit}/audit${qs ? '?' + qs : ''}`,
    byEntity:  (id) => `${SERVICES.audit}/audit/entity/${id}`,
    byUser:    (id) => `${SERVICES.audit}/audit/user/${id}`,
    anomalies: () => `${SERVICES.audit}/audit/anomalies`,
  },

  reporting: {
    dashboard:      (qs) => `${SERVICES.reporting}/dashboard/manager${qs ? '?' + qs : ''}`,
    occupancy:      (qs) => `${SERVICES.reporting}/dashboard/occupancy${qs ? '?' + qs : ''}`,
    liveSummary:    (qs) => `${SERVICES.reporting}/dashboard/live-summary${qs ? '?' + qs : ''}`,
    mostUsedRoom:   (qs) => `${SERVICES.reporting}/dashboard/most-used-room${qs ? '?' + qs : ''}`,
    guestReport:    (qs) => `${SERVICES.reporting}/reports/guests${qs ? '?' + qs : ''}`,
    shifts:         (qs) => `${SERVICES.reporting}/dashboard/shifts${qs ? '?' + qs : ''}`,
    salesReport:    (qs) => `${SERVICES.reporting}/reports/sales${qs ? '?' + qs : ''}`,
    libroVentas:    (qs) => `${SERVICES.reporting}/reports/libro-ventas?${qs}`,
    occupancyReport:(qs) => `${SERVICES.reporting}/reports/occupancy${qs ? '?' + qs : ''}`,
  },
  
  infrastructure: {
    discovery: (service) => `${SERVICES[service]}/internal/discovery`,
  },
}

export default ENDPOINTS
