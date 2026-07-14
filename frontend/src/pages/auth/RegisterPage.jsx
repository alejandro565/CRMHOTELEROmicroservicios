import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Button, Input, Spinner } from '../../components/ui'
import toast from 'react-hot-toast'
import api from '../../services/api.client'
import ENDPOINTS from '../../config/api.config'
import { useQuery } from '@tanstack/react-query'
import { Building2, CheckCircle2, ChevronRight, ChevronLeft, CreditCard, Hotel, Map, ShieldCheck, Sparkles, UserRound } from 'lucide-react'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    plan_id: '',
    plan_name: '',
    hotel_name: '',
    tax_id: '',
    owner_name: '',
    owner_email: '',
    owner_password: '',
    card_number: '',
    card_expiry: '',
    card_cvc: ''
  })

  // Fetch planes públicos
  const { data: plansRes, isLoading: isLoadingPlans } = useQuery({
    queryKey: ['public-plans'],
    queryFn: () => api.get(ENDPOINTS.saas.listPlans()),
  })
  
  const plans = plansRes?.data || []

  const updateForm = (fields) => setForm(f => ({ ...f, ...fields }))

  const handleNext = (e) => {
    e?.preventDefault()
    if (step === 1 && !form.plan_id) return toast.error('Selecciona un plan para continuar')
    setStep(s => s + 1)
  }

  const handleBack = () => setStep(s => s - 1)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // 1. Simular validación de pago (Mock)
      if (form.card_number.length < 15) throw new Error('Número de tarjeta inválido')
      
      // 2. Registrar el Owner (auth-service)
      await api.post(ENDPOINTS.auth.registerOwner(), {
        full_name: form.owner_name,
        email: form.owner_email,
        password: form.owner_password,
      })

      // 3. Login manual temporal para obtener el JWT y proveer credenciales para crear el hotel
      const loginRes = await api.post(ENDPOINTS.auth.login(), {
        email: form.owner_email,
        password: form.owner_password
      })
      
      const tempToken = loginRes.token || loginRes.accessToken
      
      // 4. Crear el primer Hotel y adjuntarlo al Plan (saas-service) usando el token temporal
      await api.post(
        ENDPOINTS.saas.createFirstTenant(),
        {
          plan_id: form.plan_id,
          name: form.hotel_name,
          tax_id: form.tax_id,
        },
        { Authorization: `Bearer ${tempToken}` }
      )

      // 5. Iniciar sesión formalmente en el Context (esto setea tokens locales y context)
      await login(form.owner_email, form.owner_password)

      toast.success('¡Registro exitoso! Bienvenido a tu ecosistema.')
      navigate('/dashboard')

    } catch (err) {
      if (err.data?.meta?.fields) {
        const errorMsgs = err.data.meta.fields.map(f => f.msg).join(' • ');
        toast.error(`Verifica tus datos: ${errorMsgs}`);
      } else {
        toast.error(err.message || 'Error durante el registro');
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // ==== VIEWS PER STEP ====

  const Step1Plans = () => (
    <div className="animate-fade-in">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-heading font-bold text-white mb-2">Selecciona un Plan</h2>
        <p className="text-surface-400">Escala de manera predecible a medida que crece tu negocio.</p>
      </div>
      
      {isLoadingPlans ? (
        <div className="flex justify-center py-12"><Spinner size={40} className="text-brand-500"/></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {plans.map(p => {
            const isSelected = form.plan_id === p.id
            const isUnlimited = p.max_hotels === 0
            
            return (
              <div 
                key={p.id}
                onClick={() => updateForm({ plan_id: p.id, plan_name: p.name })}
                className={`relative p-6 rounded-2xl cursor-pointer transition-all duration-300 border backdrop-blur-md
                  ${isSelected
                    ? 'bg-brand-500/20 border-brand-500 shadow-[0_0_30px_rgba(59,130,246,0.3)] scale-[1.02]' 
                    : 'bg-surface-800/50 border-surface-700 hover:border-surface-500 hover:bg-surface-800'}`}
              >
                {isSelected && <div className="absolute top-4 right-4 text-brand-400"><CheckCircle2 className="w-6 h-6"/></div>}
                
                <h3 className="text-xl font-heading font-bold text-white mb-1">{p.name}</h3>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-2xl font-bold text-brand-400">Bs. {p.price}</span>
                  <span className="text-surface-400 text-sm">/ mes</span>
                </div>

                <ul className="space-y-3">
                  <li className="flex items-center gap-2 text-surface-300 text-sm">
                    <Building2 className="w-4 h-4 text-brand-500"/> 
                    {isUnlimited ? 'Hoteles Ilimitados' : `Hasta ${p.max_hotels} hoteles`}
                  </li>
                  <li className="flex items-center gap-2 text-surface-300 text-sm">
                    <Hotel className="w-4 h-4 text-brand-500"/> 
                    {p.max_rooms_per_hotel === 0 ? 'Habitaciones ilimitadas' : `Hasta ${p.max_rooms_per_hotel} hab. por hotel`}
                  </li>
                  <li className="flex items-center gap-2 text-surface-300 text-sm">
                    <ShieldCheck className="w-4 h-4 text-brand-500"/> 
                    Módulos activos: {p.modules?.length || 'Todos basicos'}
                  </li>
                </ul>
              </div>
            )
          })}
        </div>
      )}
      
      <div className="flex justify-end">
        <Button variant="primary" onClick={handleNext} disabled={!form.plan_id} className="w-full sm:w-auto h-12 px-8 text-base">
          Continuar <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )

  const Step2Details = () => (
    <div className="animate-fade-in relative z-10">
      <div className="mb-8">
        <h2 className="text-2xl font-heading font-bold text-white mb-2">Detalles de Operación</h2>
        <p className="text-surface-400 text-sm">Ingresa la información fiscal del hotel y los datos de tu cuenta de gerente.</p>
      </div>
      
      <form onSubmit={handleNext} className="space-y-6">
        <div className="bg-surface-800/30 p-5 rounded-2xl border border-surface-700/50">
          <h3 className="text-white font-medium mb-4 flex items-center gap-2"><Map className="w-4 h-4 text-brand-500"/> Información de la Propiedad</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input 
              label="Nombre Comercial del Hotel"
              placeholder="Ej. Gran Hotel Plaza"
              value={form.hotel_name} onChange={e => updateForm({ hotel_name: e.target.value })}
              required
              className="[&>label]:text-surface-300 [&>input]:bg-surface-800/80 [&>input]:text-white [&>input]:border-surface-600 focus:[&>input]:border-brand-500"
            />
            <Input 
              label="NIT Comercial"
              placeholder="Número de Identificación Tributaria"
              value={form.tax_id} onChange={e => updateForm({ tax_id: e.target.value })}
              required
              className="[&>label]:text-surface-300 [&>input]:bg-surface-800/80 [&>input]:text-white [&>input]:border-surface-600 focus:[&>input]:border-brand-500"
            />
          </div>
        </div>

        <div className="bg-surface-800/30 p-5 rounded-2xl border border-surface-700/50">
          <h3 className="text-white font-medium mb-4 flex items-center gap-2"><UserRound className="w-4 h-4 text-brand-500"/> Cuenta de Gerencia (Owner)</h3>
          <div className="space-y-4">
            <Input 
              label="Nombre Completo"
              placeholder="Ej. Juan Pérez"
              value={form.owner_name} onChange={e => updateForm({ owner_name: e.target.value })}
              required
              className="[&>label]:text-surface-300 [&>input]:bg-surface-800/80 [&>input]:text-white [&>input]:border-surface-600 focus:[&>input]:border-brand-500"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input 
                label="Correo Electrónico" type="email"
                placeholder="gerencia@hotel.com"
                value={form.owner_email} onChange={e => updateForm({ owner_email: e.target.value })}
                required
                className="[&>label]:text-surface-300 [&>input]:bg-surface-800/80 [&>input]:text-white [&>input]:border-surface-600 focus:[&>input]:border-brand-500"
              />
              <Input 
                label="Contraseña Administrativa" type="password"
                placeholder="Mínimo 8, 1 mayúscula, 1 número"
                value={form.owner_password} onChange={e => updateForm({ owner_password: e.target.value })}
                required minLength={8} pattern="^(?=.*[A-Z])(?=.*\d).{8,}$"
                title="Debe tener mínimo 8 caracteres, al menos 1 mayúscula y 1 número"
                className="[&>label]:text-surface-300 [&>input]:bg-surface-800/80 [&>input]:text-white [&>input]:border-surface-600 focus:[&>input]:border-brand-500"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-between pt-4">
          <Button type="button" variant="ghost" onClick={handleBack} className="text-surface-300 hover:text-white">
            <ChevronLeft className="w-4 h-4" /> Volver
          </Button>
          <Button type="submit" variant="primary" className="px-8">
            Continuar al Pago <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  )

  const Step3Payment = () => (
    <div className="animate-fade-in">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-heading font-bold text-white mb-2">Simulación de Pago</h2>
        <p className="text-surface-400 text-sm">Estás a un paso. Inicia la suscripción de tu entorno.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-sm mx-auto">
        <div className="bg-gradient-to-br from-surface-800 to-surface-900 p-6 rounded-2xl border border-surface-700 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/10 rounded-full blur-2xl"></div>
          
          <div className="flex items-center justify-between mb-8">
            <CreditCard className="text-surface-400 w-8 h-8" />
            <span className="text-brand-400 font-bold border border-brand-500/30 px-3 py-1 rounded-full text-xs">Pago Seguro</span>
          </div>

          <div className="space-y-4 relative z-10">
            <Input 
              label="Número de Tarjeta" 
              placeholder="0000 0000 0000 0000"
              value={form.card_number} onChange={e => updateForm({ card_number: e.target.value })}
              required minLength={15} maxLength={19}
              autoComplete="cc-number"
              className="[&>label]:text-surface-400 [&>input]:bg-surface-900/50 [&>input]:border-surface-700 [&>input]:text-white focus:[&>input]:border-brand-500 font-mono"
            />
            
            <div className="grid grid-cols-2 gap-4">
              <Input 
                label="Expiración" 
                placeholder="MM/YY"
                value={form.card_expiry} onChange={e => updateForm({ card_expiry: e.target.value })}
                required
                autoComplete="cc-exp"
                className="[&>label]:text-surface-400 [&>input]:bg-surface-900/50 [&>input]:border-surface-700 [&>input]:text-white focus:[&>input]:border-brand-500 font-mono"
              />
              <Input 
                label="CVC" type="password"
                placeholder="•••"
                value={form.card_cvc} onChange={e => updateForm({ card_cvc: e.target.value })}
                required maxLength={4}
                autoComplete="new-password"
                className="[&>label]:text-surface-400 [&>input]:bg-surface-900/50 [&>input]:border-surface-700 [&>input]:text-white focus:[&>input]:border-brand-500 font-mono"
              />
            </div>
          </div>
        </div>

        <div className="bg-brand-500/10 border border-brand-500/20 rounded-xl p-4 flex items-center justify-between text-sm">
          <span className="text-surface-300">Total a facturar hoy:</span>
          <span className="text-white font-bold text-lg">Bs. {plans.find(p => p.id === form.plan_id)?.price || '0.00'}</span>
        </div>

        <div className="flex justify-between pt-4">
           <Button type="button" variant="ghost" onClick={handleBack} disabled={isSubmitting} className="text-surface-400">
            <ChevronLeft className="w-4 h-4" /> Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting} className="px-8 shadow-[0_0_20px_rgba(59,130,246,0.4)]">
            <Sparkles className="w-4 h-4" /> Pagar y Provisionar
          </Button>
        </div>
      </form>
    </div>
  )

  // ==== MAIN LAYOUT ====
  
  return (
    <div className="min-h-screen bg-surface-950 flex flex-col items-center justify-center py-12 px-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-1/4 left-1/4 w-[40rem] h-[40rem] bg-brand-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[30rem] h-[30rem] bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-3xl z-10">
        
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <Link to="/login" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/30 group-hover:scale-105 transition-transform">
              <Hotel className="text-white w-5 h-5" />
            </div>
            <span className="text-2xl font-heading font-bold text-white tracking-tight">HotelCRM</span>
          </Link>
        </div>

        {/* Stepper Progress */}
        <div className="max-w-md mx-auto mb-10">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-surface-800 rounded-full -z-10"></div>
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-brand-500 rounded-full -z-10 transition-all duration-500" style={{ width: `${((step - 1) / 2) * 100}%` }}></div>
            
            {[1, 2, 3].map(i => (
              <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 border-4 border-surface-950 ${
                step >= i ? 'bg-brand-500 text-white' : 'bg-surface-800 text-surface-500'
              }`}>
                {i}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs font-semibold text-surface-500 mt-3 px-2">
            <span className={step >= 1 ? 'text-brand-400' : ''}>Planes</span>
            <span className={step >= 2 ? 'text-brand-400' : ''}>Detalles</span>
            <span className={step >= 3 ? 'text-brand-400' : ''}>Checkout</span>
          </div>
        </div>

        {/* Wizard Content */}
        <div className="bg-surface-900/50 backdrop-blur-2xl border border-surface-800/80 rounded-[2rem] p-6 sm:p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
          
          {step === 1 && Step1Plans()}
          {step === 2 && Step2Details()}
          {step === 3 && Step3Payment()}
          
        </div>
        
        <p className="text-center text-surface-600 text-xs mt-8">
          ¿Ya tienes una cuenta? <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">Inicia sesión aquí</Link>
        </p>

      </div>
    </div>
  )
}
