import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'

import { AuthProvider, useAuth } from './context/AuthContext'
import AppLayout from './components/layout/AppLayout'
import { canAccessPath, getDefaultPath } from './config/access'

const RoleBasedRedirect = () => {
  const { user } = useAuth()
  return <Navigate to={getDefaultPath(user)} replace />
}

const RequirePermission = ({ path, children }) => {
  const { user } = useAuth()
  if (!canAccessPath(user, path)) return <Navigate to="/403" replace />
  return children
}

const ForbiddenPage = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="max-w-md text-center bg-white/80 border border-surface-200 rounded-2xl px-8 py-10 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-widest text-brand-500 mb-3">Acceso restringido</p>
      <h1 className="text-2xl font-heading font-bold text-surface-900 mb-2">No tienes permisos para ver esta seccion</h1>
      <p className="text-sm text-surface-500 mb-6">Tu rol no incluye los permisos requeridos para abrir esta pagina.</p>
      <a href="/" className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-500 transition-colors">
        Ir a mi inicio
      </a>
    </div>
  </div>
)

import LoginPage          from './pages/auth/LoginPage'
import RegisterPage       from './pages/auth/RegisterPage'
import HotelSelectorPage  from './pages/auth/HotelSelectorPage'
import DashboardPage      from './pages/dashboard/DashboardPage'
import GuestsPage         from './pages/crm/GuestsPage'
import CompaniesPage      from './pages/crm/CompaniesPage'
import LoyaltyPage        from './pages/crm/LoyaltyPage'
import ReservationsPage   from './pages/frontdesk/ReservationsPage'
import ActiveStaysPage    from './pages/frontdesk/ActiveStaysPage'
import RoomsPage          from './pages/housekeeping/RoomsPage'
import RoomTypesPage      from './pages/housekeeping/RoomTypesPage'
import BillingPage        from './pages/billing/BillingPage'
import ShiftsPage         from './pages/billing/ShiftsPage'
import InvoicesPage       from './pages/billing/InvoicesPage'
import ReportsPage        from './pages/settings/ReportsPage'
import UsersPage          from './pages/settings/UsersPage'
import RolesPage          from './pages/settings/RolesPage'
import PlansPage          from './pages/settings/PlansPage'
import AuditPage          from './pages/settings/AuditPage'
import HotelSettingsPage  from './pages/settings/HotelSettingsPage'
import GuestPortalPage   from './pages/frontdesk/GuestPortalPage'
import OccupancyCalendarPage from './pages/frontdesk/OccupancyCalendarPage'
import InfrastructureGraphPage from './pages/infrastructure/InfrastructureGraphPage'

const qc = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
})

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login"        element={<LoginPage />} />
            <Route path="/register"     element={<RegisterPage />} />
            <Route path="/select-hotel" element={<HotelSelectorPage />} />
            <Route path="/portal/:token" element={<GuestPortalPage />} />

            {/* Protected routes — AppLayout checks isAuthenticated */}
            <Route element={<AppLayout />}>
              <Route index element={<RoleBasedRedirect />} />
              <Route path="/403" element={<ForbiddenPage />} />
              <Route path="/dashboard"    element={<RequirePermission path="/dashboard"><DashboardPage /></RequirePermission>} />
              <Route path="/active-stays" element={<RequirePermission path="/active-stays"><ActiveStaysPage /></RequirePermission>} />
              <Route path="/reservations" element={<RequirePermission path="/reservations"><ReservationsPage /></RequirePermission>} />
              <Route path="/frontdesk/calendar" element={<RequirePermission path="/frontdesk/calendar"><OccupancyCalendarPage /></RequirePermission>} />
              <Route path="/rooms"        element={<RequirePermission path="/rooms"><RoomsPage /></RequirePermission>} />
              <Route path="/room-types"   element={<RequirePermission path="/room-types"><RoomTypesPage /></RequirePermission>} />
              <Route path="/guests"       element={<RequirePermission path="/guests"><GuestsPage /></RequirePermission>} />
              <Route path="/companies"    element={<RequirePermission path="/companies"><CompaniesPage /></RequirePermission>} />
              <Route path="/loyalty"      element={<RequirePermission path="/loyalty"><LoyaltyPage /></RequirePermission>} />
              <Route path="/billing"      element={<RequirePermission path="/billing"><BillingPage /></RequirePermission>} />
              <Route path="/shifts"       element={<RequirePermission path="/shifts"><ShiftsPage /></RequirePermission>} />
              <Route path="/invoices"     element={<RequirePermission path="/invoices"><InvoicesPage /></RequirePermission>} />
              <Route path="/users"        element={<RequirePermission path="/users"><UsersPage /></RequirePermission>} />
              <Route path="/roles"        element={<RequirePermission path="/roles"><RolesPage /></RequirePermission>} />
              <Route path="/plans"        element={<RequirePermission path="/plans"><PlansPage /></RequirePermission>} />
              <Route path="/audit"        element={<RequirePermission path="/audit"><AuditPage /></RequirePermission>} />
              <Route path="/reports"      element={<RequirePermission path="/reports"><ReportsPage /></RequirePermission>} />
              <Route path="/hotel-settings" element={<RequirePermission path="/hotel-settings"><HotelSettingsPage /></RequirePermission>} />
              <Route path="/infrastructure" element={<RequirePermission path="/infrastructure"><InfrastructureGraphPage /></RequirePermission>} />
            </Route>

            <Route path="*" element={<RoleBasedRedirect />} />
          </Routes>
        </BrowserRouter>

        <Toaster
          position="top-right"
          toastOptions={{
            style: { fontSize: '14px', borderRadius: '10px' },
            success: { iconTheme: { primary: '#10b981', secondary: 'white' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: 'white' } },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  )
}
