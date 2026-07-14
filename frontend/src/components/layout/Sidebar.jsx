import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getDefaultPath, hasAnyPermission } from '../../config/access'
import toast from 'react-hot-toast'
import { LayoutDashboard, CalendarDays, BedDouble, Users, Building, ShieldCheck, CreditCard, Clock, Receipt, UserCog, Settings, ListTodo, Activity, AreaChart, LogOut, ChevronDown, Check, Plus, Sparkles, X, Grid, ShieldAlert, Network } from 'lucide-react'
import ReservationModal from '../reservations/ReservationModal'

import { useQueryClient } from '@tanstack/react-query'

const BASE_NAV = [
  { section: 'Operaciones', items: [
    { to: '/dashboard',    label: 'Estadisticas',    icon: <LayoutDashboard size={18} />, permissions: ['REPORTS_OPERATIONAL', 'REPORTS_FINANCIAL'] },
    { to: '/active-stays', label: 'Gestion Operativa', icon: <Activity size={18} />, permissions: ['RESERVATIONS_VIEW'] },
    { to: '/frontdesk/calendar', label: 'Calendario de Ocupacion', icon: <Grid size={18} />, permissions: ['RESERVATIONS_VIEW'] },
    { to: '/rooms',        label: 'Habitaciones',    icon: <BedDouble size={18} />, permissions: ['HOTELS_VIEW'] },
  ]},
  { section: 'Gestion CRM', items: [
    { to: '/guests',    label: 'Huespedes',   icon: <Users size={18} />, permissions: ['GUESTS_VIEW'] },
    { to: '/companies', label: 'Empresas',    icon: <Building size={18} />, permissions: ['GUESTS_VIEW'] },
    { to: '/loyalty',   label: 'Lealtad',     icon: <ShieldCheck size={18} />, permissions: ['LOYALTY_MANAGE'] },
  ]},
  { section: 'Finanzas', items: [
    { to: '/billing',  label: 'Cajas y Pagos',  icon: <Clock size={18} />, permissions: ['BILLING_VIEW'] },
    { to: '/shifts',   label: 'Turnos',          icon: <CreditCard size={18} />, permissions: ['BILLING_CASHIER'] },
    { to: '/invoices', label: 'Facturacion',     icon: <Receipt size={18} />, permissions: ['BILLING_INVOICE'] },
    { to: '/reports',  label: 'Reportes',        icon: <AreaChart size={18} />, permissions: ['REPORTS_OPERATIONAL', 'REPORTS_FINANCIAL'] },
  ]},
  { section: 'Configuracion', items: [
    { to: '/hotel-settings', label: 'Ajustes Hotel',  icon: <Settings size={18} />, permissions: ['HOTELS_CONFIG', 'USERS_VIEW', 'USERS_MANAGE', 'ROLES_MANAGE', 'USERS_ROLES', 'EXCHANGE_MANAGE', 'INVENTORY_MANAGE'] },
    { to: '/users',          label: 'Personal',       icon: <UserCog size={18} />, permissions: ['USERS_VIEW'] },
    { to: '/roles',          label: 'Roles',          icon: <ListTodo size={18} />, permissions: ['ROLES_MANAGE', 'USERS_ROLES'] },
    { to: '/plans',          label: 'Plan SaaS',      icon: <Sparkles size={18} />, permissions: ['OWNER_MANAGE_PLAN'] },
    { to: '/audit',          label: 'Auditoria',      icon: <ShieldAlert size={18} />, permissions: ['AUDIT_VIEW'] },
    { to: '/infrastructure',  label: 'Infraestructura', icon: <Network size={18} />, permissions: ['AUDIT_VIEW'] },
  ]},
]

export default function Sidebar({ mobileMenuOpen, onCloseMobileMenu }) {
  const { user, logout, ownedTenants, switchHotel, hasPermission } = useAuth()
  const navigate = useNavigate()
  const [showSwitcher, setShowSwitcher] = useState(false)
  const [switching, setSwitching]       = useState(null)
  
  // Modal states for reservations
  const [modalMode, setModalMode] = useState(null) // 'RESERVATION' or 'CHECK_IN'
  const [showModeSelector, setShowModeSelector] = useState(false)
  const [showOldCheckIn, setShowOldCheckIn] = useState(false) // temporary if needed
  const qc = useQueryClient()

  const handleLogout = async () => { await logout(); navigate('/login') }

  const handleSwitch = async (tenant_id) => {
    if (tenant_id === user?.tenant_id) { setShowSwitcher(false); return }
    setSwitching(tenant_id)
    try {
      const data = await switchHotel(tenant_id)
      setShowSwitcher(false)
      toast.success('Hotel cambiado exitosamente')
      window.location.href = getDefaultPath(data.user)
    } catch (err) {
      toast.error(err.message || 'Error al cambiar de hotel')
    } finally {
      setSwitching(null)
    }
  }

  const currentHotel = ownedTenants.find(t => t.tenant_id === user?.tenant_id)
  const userRole = (user?.role || user?.role_name || '').toUpperCase()
  const isOwner = userRole === 'OWNER'
  
  const hasMultipleHotels = ownedTenants.length > 1
  const canSwitch = hasMultipleHotels || hasPermission('OWNER_VIEW_HOTELS')

  const canReserve = hasPermission('RESERVATIONS_CREATE')
  const canCheckIn = hasPermission('RESERVATIONS_CHECKIN') || hasPermission('CHECKIN_EXECUTE')

  const handleOpenAction = () => {
    if (canReserve && canCheckIn) {
      setShowModeSelector(true)
    } else if (canReserve) {
      setModalMode('RESERVATION')
    } else if (canCheckIn) {
      setModalMode('CHECK_IN')
    } else {
      toast.error('No tienes permisos para esta accion')
    }
  }

  const filteredNav = BASE_NAV.map(group => {
    const items = group.items.filter(item => hasAnyPermission(user, item.permissions || []));
    return { ...group, items };
  }).filter(group => group.items.length > 0);

  return (
    <>
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm transition-opacity"
          onClick={onCloseMobileMenu}
        />
      )}
      <aside className={`w-64 bg-surface-900 border-r border-surface-800 flex flex-col h-full md:h-screen md:sticky top-0 shrink-0 text-white shadow-2xl z-40 overflow-visible transition-transform duration-300 fixed md:relative ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        {/* Glow effect back */}
      <div className="absolute top-0 left-0 w-full h-40 bg-brand-500/10 rounded-full blur-[80px] pointer-events-none"></div>

      {/* Header & Switcher */}
      <div className="px-5 py-5 border-b border-surface-800/50 relative z-30">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 relative flex items-center justify-center shrink-0">
            <div className="absolute inset-0 bg-brand-500 rounded-xl rotate-3"></div>
            <div className="absolute inset-0 bg-indigo-600 rounded-xl -rotate-3 opacity-70"></div>
            <span className="relative text-white font-heading font-bold text-lg">H</span>
          </div>
          <span className="font-heading font-bold text-lg tracking-tight">HotelCRM</span>
        </div>

        {/* Current Hotel Pill */}
        {currentHotel || user?.tenant_id ? (
          <div className="relative">
            <button
              onClick={() => canSwitch && setShowSwitcher(s => !s)}
              className={`w-full flex items-center justify-between px-3 py-2 bg-surface-800/50 border border-surface-700/50 hover:bg-surface-800 rounded-xl transition-all duration-200
                ${canSwitch ? 'cursor-pointer hover:border-brand-500/50 hover:shadow-[0_0_15px_rgba(59,130,246,0.15)]' : 'cursor-default'}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
                  <span className="text-white text-xs font-bold font-heading">
                    {(currentHotel?.hotel_name || 'H').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex flex-col items-start min-w-0">
                  <span className="text-sm font-semibold text-white truncate leading-tight">
                    {currentHotel?.hotel_name || 'Mi hotel'}
                  </span>
                  <span className="text-[10px] text-surface-400 font-medium tracking-wide uppercase">
                    {currentHotel?.role_name || user?.role || 'Admin'}
                  </span>
                </div>
              </div>
              {canSwitch && (
                <ChevronDown size={14} className={`text-surface-400 transition-transform duration-300 ${showSwitcher ? 'rotate-180' : ''}`} />
              )}
            </button>

            {/* Dropdown */}
            {showSwitcher && canSwitch && (
              <div className="absolute top-full left-0 w-full mt-2 rounded-xl border border-surface-700 bg-surface-800/95 backdrop-blur-xl shadow-xl shadow-black/40 overflow-hidden z-50 animate-fade-in">
                <div className="py-2">
                  <div className="px-3 pb-2 mb-2 border-b border-surface-700/50 text-[10px] font-bold text-surface-400 uppercase tracking-wider">
                    Cambiar Propiedad
                  </div>
                  <div className="max-h-48 overflow-y-auto px-1">
                    {ownedTenants.map(t => (
                      <button
                        key={t.tenant_id}
                        onClick={() => handleSwitch(t.tenant_id)}
                        disabled={!!switching}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition-all duration-200
                          ${t.tenant_id === user?.tenant_id
                            ? 'bg-brand-500/10 text-brand-400 font-semibold'
                            : 'text-surface-300 hover:bg-surface-700 hover:text-white'}`}
                      >
                        <span className="truncate flex-1 font-medium">{t.hotel_name || `Hotel ${t.tenant_id.slice(0,6)}`}</span>
                        
                        {switching === t.tenant_id && (
                          <svg className="animate-spin w-4 h-4 text-brand-500" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2"/>
                            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                          </svg>
                        )}
                        {t.tenant_id === user?.tenant_id && !switching && (
                          <Check size={16} className="text-brand-500" />
                        )}
                      </button>
                    ))}
                  </div>

                  {isOwner && (
                    <div className="mt-2 pt-2 border-t border-surface-700/50 px-1">
                      <button
                        onClick={() => navigate('/select-hotel')}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-surface-300 hover:bg-brand-500/10 hover:text-brand-400 transition-all font-medium"
                      >
                        <Building size={16} />
                        <span>Gestionar Hoteles</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
      
      {/* Quick Actions */}
      {(canReserve || canCheckIn) && (
        <div className="px-5 py-2 mb-2 relative z-10 space-y-2">
          <button 
            onClick={handleOpenAction}
            className="w-full flex items-center justify-center gap-2 py-3 bg-brand-600 hover:bg-brand-500 rounded-2xl transition-all group shadow-lg shadow-brand-500/20"
          >
            <Sparkles className="w-4 h-4 text-brand-100" />
            <span className="text-xs font-bold uppercase tracking-tight text-white">Nueva Operacion</span>
          </button>
        </div>
      )}
      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-5 px-3 custom-scrollbar relative z-10">
        {filteredNav.map((group) => (
          <div key={group.section} className="mb-6">
            <p className="text-[10px] font-bold text-surface-500 uppercase tracking-widest px-3 mb-2">
              {group.section}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavLink key={item.to} to={item.to}
                  onClick={onCloseMobileMenu}
                  className={({ isActive }) =>
                    `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative overflow-hidden ${
                      isActive
                        ? 'text-white bg-brand-500/10 shadow-[0_0_15px_rgba(59,130,246,0.1)] border border-brand-500/20'
                        : 'text-surface-400 hover:text-white hover:bg-surface-800 border border-transparent'
                    }`
                  }>
                  {({ isActive }) => (
                    <>
                      {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-brand-500 rounded-r-full shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>}
                      <span className={`transition-colors duration-200 ${isActive ? 'text-brand-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]' : 'text-surface-500 group-hover:text-surface-300'}`}>
                        {item.icon}
                      </span>
                      {item.label}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-surface-800/50 p-4 bg-surface-900/50 relative z-10">
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-surface-700 to-surface-600 border border-surface-500/30 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-inner">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate leading-tight">{user?.name || 'Usuario'}</p>
            <p className="text-xs text-brand-400 truncate font-medium">{user?.role || ''}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="p-2 text-surface-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
      
      <ReservationModal 
        isOpen={!!modalMode} 
        onClose={() => setModalMode(null)} 
        mode={modalMode}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['active-stays'] });
          qc.invalidateQueries({ queryKey: ['reservations'] });
          qc.invalidateQueries({ queryKey: ['calendar-reservations'] });
        }}
      />

      {/* Mode Selector Mini-Modal */}
      {showModeSelector && createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setShowModeSelector(false)}>
          <div className="bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] w-full max-w-sm overflow-hidden animate-zoom-in border border-surface-200" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-surface-100 flex justify-between items-center bg-surface-50">
              <h3 className="font-heading font-bold text-surface-900">¿Qué deseas hacer?</h3>
              <button onClick={() => setShowModeSelector(false)} className="p-1.5 rounded-lg hover:bg-surface-200 text-surface-400 hover:text-surface-700 transition-colors">
                <X size={18}/>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <button onClick={() => { setModalMode('CHECK_IN'); setShowModeSelector(false) }}
                className="w-full flex items-center gap-4 p-5 rounded-2xl border border-emerald-100 bg-emerald-50/50 hover:bg-emerald-100 hover:border-emerald-200 transition-all text-left group">
                <div className="w-12 h-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform">
                  <Check size={24} />
                </div>
                <div>
                  <p className="font-bold text-emerald-900 text-sm">Realizar Check-in</p>
                  <p className="text-xs text-emerald-600 mt-0.5 leading-relaxed">Ingreso inmediato con asignación de habitación física.</p>
                </div>
              </button>
              
              <button onClick={() => { setModalMode('RESERVATION'); setShowModeSelector(false) }}
                className="w-full flex items-center gap-4 p-5 rounded-2xl border border-brand-100 bg-brand-50/50 hover:bg-brand-100 hover:border-brand-200 transition-all text-left group">
                <div className="w-12 h-12 rounded-xl bg-brand-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-brand-600/20 group-hover:scale-110 transition-transform">
                  <CalendarDays size={24} />
                </div>
                <div>
                  <p className="font-bold text-brand-900 text-sm">Crear Reserva</p>
                  <p className="text-xs text-brand-600 mt-0.5 leading-relaxed">Reservar estadía para una fecha futura.</p>
                </div>
              </button>
            </div>
          </div>
        </div>,
        document.getElementById('modal-root') || document.body
      )}
    </aside>
    </>
  )
}
