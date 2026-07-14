import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Spinner, Button, Input, Card, CardHeader, CardBody } from '../../components/ui'
import api from '../../services/api.client'
import ENDPOINTS from '../../config/api.config'
import toast from 'react-hot-toast'
import { Building2, ChevronRight, LogOut, Plus, Hotel, CheckCircle2 } from 'lucide-react'

export default function HotelSelectorPage() {
  const { pendingSelection, selectHotel, switchHotel, logout, refreshPendingSelection, user: authUser, ownedTenants, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  
  const [loading, setLoading] = useState(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newHotel, setNewHotel] = useState({ name: '', tax_id: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Support two modes: Login-time selection (pendingSelection) or already-logged-in property management (ownedTenants)
  const user = pendingSelection?.user || authUser
  const tenants = pendingSelection?.tenants || ownedTenants || []

  if (!pendingSelection && !isAuthenticated) {
    navigate('/login', { replace: true })
    return null
  }

  // --- Plan Limit Verification ---
  // If user has a "Basic" plan and already has 1 hotel, we should restrict creation.
  const hasBasicPlan = tenants.some(t => t.plan_name?.toLowerCase().includes('básico') || t.plan_name?.toLowerCase().includes('basico'))
  const hotelLimitReached = hasBasicPlan && tenants.length >= 1 && !pendingSelection // Usually verification happens when logged in

  const handleSelect = async (tenant_id) => {
    setLoading(tenant_id)
    try {
      if (pendingSelection) {
        // Initial login flow
        await selectHotel(tenant_id)
      } else if (isAuthenticated) {
        // Already logged in flow (management/switching)
        if (tenant_id !== authUser?.tenant_id) {
          await switchHotel(tenant_id)
        }
      }
      
      toast.success('Entrando al hotel...')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      toast.error(err.message || 'Error al seleccionar el hotel')
    } finally {
      setLoading(null)
    }
  }

  const handleCreateHotel = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      // Regular creation (for owners who already have a plan linked)
      await api.post(ENDPOINTS.saas.createTenant(), newHotel)
      toast.success('¡Hotel creado con éxito!')
      await refreshPendingSelection()
      setIsCreating(false)
      setNewHotel({ name: '', tax_id: '' })
    } catch (err) {
      toast.error(err.message || 'Error al crear el hotel')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-to-bl from-brand-100 to-transparent opacity-60 rounded-bl-[100%] pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-gradient-to-tr from-accent-light to-transparent opacity-60 rounded-tr-[100%] pointer-events-none"></div>

      <div className="w-full max-w-lg z-10 animate-fade-up">

        {!isCreating ? (
          <>
            {/* Header */}
            <div className="text-center mb-10">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-brand-500/10 border border-brand-100">
                <Building2 className="text-brand-600 w-8 h-8" />
              </div>
              <h1 className="text-3xl font-heading font-bold text-surface-900 tracking-tight">Tus Propiedades</h1>
              <p className="text-surface-500 font-medium mt-2">
                Bienvenido, <span className="text-brand-600 font-semibold">{user?.name}</span>. Selecciona un hotel.
              </p>
            </div>

            {/* Hotel Cards Catalog */}
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
              {tenants.map((t, i) => {
                const isLoading = loading === t.tenant_id
                const isUnlimited = t.max_rooms_per_hotel === 0

                return (
                  <button
                    key={t.tenant_id}
                    onClick={() => handleSelect(t.tenant_id)}
                    disabled={!!loading}
                    style={{ animationDelay: `${i * 75}ms` }}
                    className="w-full relative group bg-white rounded-2xl border border-surface-200 shadow-sm p-4 animate-fade-in
                               hover:shadow-md hover:border-brand-300 focus:outline-none focus:ring-4 focus:ring-brand-50
                               transition-all duration-300 text-left active:scale-[0.98] disabled:opacity-60 disabled:cursor-wait"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-brand-500 to-accent opacity-0 group-hover:opacity-5 rounded-2xl transition-opacity duration-300"></div>

                    <div className="relative flex items-center justify-between gap-4">
                      <div className="w-12 h-12 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center shrink-0 group-hover:bg-brand-100 transition-colors duration-300">
                        <span className="text-brand-600 font-heading font-bold text-xl">
                          {(t.hotel_name || t.name || 'H').charAt(0).toUpperCase()}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-surface-900 truncate">
                          {t.hotel_name || t.name || `Hotel ${t.tenant_id.slice(0, 6)}`}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-brand-50 text-brand-700 border border-brand-200/50">
                            {t.role_name || 'OWNER'}
                          </span>
                          <span className="text-[11px] font-medium text-surface-400">
                            • {t.plan_name}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full group-hover:bg-brand-50 transition-colors">
                        {isLoading
                          ? <Spinner size={20} className="text-brand-500" />
                          : <ChevronRight className="text-surface-300 group-hover:text-brand-500 transition-colors w-5 h-5" />
                        }
                      </div>
                    </div>
                  </button>
                )
              })}

              {/* Add New Hotel Action */}
              <button
                onClick={() => !hotelLimitReached && setIsCreating(true)}
                disabled={hotelLimitReached}
                className={`w-full bg-white/40 backdrop-blur-sm rounded-2xl border-2 border-dashed p-4 transition-all group flex items-center gap-4
                           ${hotelLimitReached 
                             ? 'opacity-60 cursor-not-allowed border-surface-200' 
                             : 'border-surface-300 hover:bg-white/60 hover:border-brand-400 hover:text-brand-600'}`}
              >
                <div className={`w-12 h-12 rounded-xl border flex items-center justify-center transition-colors
                                ${hotelLimitReached
                                  ? 'bg-surface-50 border-surface-100 text-surface-400'
                                  : 'bg-surface-100 border-surface-200 group-hover:bg-brand-50 group-hover:border-brand-200 text-surface-400 group-hover:text-brand-500'}`}>
                  <Plus className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <p className={`font-bold ${hotelLimitReached ? 'text-surface-400' : 'text-surface-500 group-hover:text-brand-600'}`}>
                    {hotelLimitReached ? 'Límite de hoteles alcanzado' : 'Agregar nuevo hotel'}
                  </p>
                  {hotelLimitReached && (
                    <p className="text-[10px] font-medium text-surface-400 uppercase tracking-widest mt-0.5">Mejora tu plan para añadir más propiedades</p>
                  )}
                </div>
              </button>
            </div>
          </>
        ) : (
          <div className="animate-fade-in">
            <Card className="shadow-2xl border-none ring-1 ring-surface-200">
              <CardHeader className="bg-brand-600 text-white rounded-t-2xl p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                <Hotel className="w-12 h-12 mb-4 opacity-90" />
                <h2 className="text-2xl font-heading font-bold">Nueva Propiedad</h2>
                <p className="text-white/80 text-sm mt-1">Configura los datos fiscales de tu nuevo hotel.</p>
              </CardHeader>
              <CardBody className="p-8">
                <form onSubmit={handleCreateHotel} className="space-y-5">
                  <Input 
                    label="Nombre del Hotel" required
                    placeholder="Ej: Gran Hotel Continental"
                    value={newHotel.name}
                    onChange={e => setNewHotel({ ...newHotel, name: e.target.value })}
                  />
                  <Input 
                    label="NIT / Documento Fiscal" required
                    placeholder="Ej: 1020304050"
                    value={newHotel.tax_id}
                    onChange={e => setNewHotel({ ...newHotel, tax_id: e.target.value })}
                  />
                  
                  <div className="bg-brand-50/50 p-4 rounded-xl border border-brand-100/50 flex gap-3">
                    <CheckCircle2 className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-brand-800 leading-relaxed font-medium">
                      Tu nuevo hotel heredará automáticamente el plan actual. Podrás configurar habitaciones, precios y empleados desde el panel de ajustes una vez creado.
                    </p>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button 
                      type="button" 
                      variant="secondary" 
                      className="flex-1" 
                      onClick={() => setIsCreating(false)}
                      disabled={isSubmitting}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      variant="primary" 
                      className="flex-[2]" 
                      loading={isSubmitting}
                    >
                      Crear Hotel
                    </Button>
                  </div>
                </form>
              </CardBody>
            </Card>
          </div>
        )}

        {/* Cancel Action */}
        <div className="mt-8 text-center animate-fade-in delay-300">
          <button 
            onClick={isAuthenticated ? () => navigate('/dashboard') : handleCancel}
            className="inline-flex items-center gap-2 text-sm font-medium text-surface-500 hover:text-surface-800 transition-colors"
          >
            {isAuthenticated ? <ChevronRight className="w-4 h-4 rotate-180" /> : <LogOut className="w-4 h-4" />}
            {isAuthenticated ? 'Volver al panel' : 'Cerrar sesión'}
          </button>
        </div>

      </div>
    </div>
  )
}
