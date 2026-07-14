import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { 
  User, MapPin, Globe, Calendar, Mail, Phone, 
  CheckCircle, ShieldCheck, Sparkles, AlertCircle,
  Building, Bed, ArrowRight, Save, Clock, ChevronRight,
  UserCheck, UserPlus, Info, Users
} from 'lucide-react'
import api from '../../services/api.client'
import ENDPOINTS from '../../config/api.config'
import { Button, Input, Spinner, Select } from '../../components/ui'
import GuestFormFields from '../../components/guests/GuestFormFields'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const DOC_TYPES = [
  { value: 'CI', label: 'C.I.' },
  { value: 'PASSPORT', label: 'Pasaporte' },
  { value: 'FOREIGN_ID', label: 'Doc. Extranjero' },
]

const CIVIL_STATUS = ['Soltero', 'Casado', 'Divorciado', 'Viudo', 'Unión Libre']
const GENDERS = [{ value: 'M', label: 'Masculino' }, { value: 'F', label: 'Femenino' }, { value: 'OTHER', label: 'Otro' }]

const formatLocalDate = (dateStr) => {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  return format(new Date(y, m - 1, d), 'dd MMM yyyy')
}

export default function GuestPortalPage() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [reservation, setReservation] = useState(null)
  const [error, setError] = useState(null)
  const [submitted, setSubmitted] = useState(false)

  // Single form state
  const [formData, setFormData] = useState({
    first_name: '', last_name: '', doc_type: 'CI', doc_number: '',
    email: '', phone: '', nationality: '', gender: 'M',
    birth_date: '', civil_status: 'Soltero',
    origin_country_code: '', origin_country: '', origin_city: ''
  })

  // Stats for the reservation
  const [occupancy, setOccupancy] = useState({ current: 0, total: 0 })

  useEffect(() => {
    loadReservation()
  }, [token])

  const loadReservation = async () => {
    try {
      setLoading(true)
      const res = await api.get(`${ENDPOINTS.reservation.root}/portal/${token}`)
      const data = res.data || res
      setReservation(data)

      // Calculate occupancy
      console.log('[Portal] Reservation data:', data)
      const current = data.guest_list?.length || 0
      setOccupancy({ current, total: 0 })
    } catch (err) {
      setError(err.message || 'Error al cargar la reserva')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateField = (field, value) => {
    if (typeof field === 'object') {
      setFormData(prev => ({ ...prev, ...field }))
    } else {
      setFormData(prev => ({ ...prev, [field]: value }))
    }
  }

  const handleSubmit = async () => {
    if (!formData.first_name || !formData.last_name || !formData.doc_number) {
      return toast.error('Nombre, apellido y documento son obligatorios')
    }

    setSubmitting(true)
    try {
      await api.post(`${ENDPOINTS.reservation.root}/portal/${token}/submit`, formData)
      setSubmitted(true)
      toast.success('¡Tus datos han sido registrados!')
    } catch (err) {
      toast.error(err.message || 'Error al enviar los datos')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-6">
      <div className="text-center space-y-4">
        <Spinner size={40} className="text-brand-600 mx-auto" />
        <p className="text-surface-500 font-medium animate-pulse">Abriendo tu portal de registro...</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white p-8 rounded-[32px] shadow-xl border border-surface-200 text-center space-y-6">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto">
          <AlertCircle size={32} />
        </div>
        <h1 className="text-xl font-heading font-bold text-surface-900">Enlace no válido</h1>
        <p className="text-surface-500 text-sm">{error}.</p>
      </div>
    </div>
  )

  if (submitted) return (
    <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white p-10 rounded-[40px] shadow-2xl border border-emerald-100 text-center space-y-8 animate-zoom-in">
        <div className="w-20 h-20 bg-emerald-500 text-white rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
          <CheckCircle size={40} />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-heading font-bold text-surface-900">¡Registro Exitoso!</h1>
          <p className="text-surface-500 text-sm">Tus datos han sido enviados a recepción. ¡Te esperamos para tu estancia!</p>
        </div>
        <div className="pt-4">
           <Button fullWidth variant="ghost" onClick={() => window.location.reload()}>Registrar a otro acompañante</Button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-surface-50 pb-12">
      {/* Header */}
      <div className="bg-surface-900 text-white px-6 py-20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-[100px] -mr-48 -mt-48" />
        <div className="max-w-3xl mx-auto relative z-10">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 bg-brand-600 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-600/30">
              <Users className="text-white" size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-heading font-bold leading-tight">Registro de Huésped</h1>
              <p className="text-surface-400 text-sm mt-1">Completa tus datos para agilizar tu llegada.</p>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-[28px] p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-surface-400 uppercase tracking-widest flex items-center gap-1.5">
                <Clock size={12} /> Llegada
              </p>
              <p className="text-sm font-bold text-white">{formatLocalDate(reservation.rooms[0].check_in_date)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-surface-400 uppercase tracking-widest flex items-center gap-1.5">
                <Calendar size={12} /> Salida
              </p>
              <p className="text-sm font-bold text-white">{formatLocalDate(reservation.rooms[0].check_out_date)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-surface-400 uppercase tracking-widest flex items-center gap-1.5">
                <Users size={12} /> Ocupación
              </p>
              <p className="text-sm font-bold text-white">{occupancy.current} invitados registrados</p>
            </div>
            <div className="hidden md:block space-y-1">
              <p className="text-[10px] font-bold text-surface-400 uppercase tracking-widest flex items-center gap-1.5">
                <ShieldCheck size={12} /> Seguridad
              </p>
              <p className="text-sm font-bold text-emerald-400">Verificado</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 -mt-16 relative z-20">
        <div className="bg-white rounded-[32px] shadow-2xl border border-surface-100 overflow-hidden animate-fade-up">
          <div className="bg-surface-50 px-8 py-5 border-b border-surface-100 flex items-center gap-3">
             <div className="w-10 h-10 bg-white border border-surface-200 rounded-xl flex items-center justify-center text-brand-600 shadow-sm">
                <UserPlus size={20} />
             </div>
             <div>
                <h3 className="font-bold text-surface-900">Formulario de Registro</h3>
                <p className="text-xs text-surface-500">Ingresa tus datos personales a continuación.</p>
             </div>
          </div>

          <div className="p-8 space-y-6">
            <GuestFormFields 
              values={formData} 
              onChange={handleUpdateField} 
              showOrigin={true} 
            />

            <div className="pt-6">
              <Button fullWidth size="lg" variant="primary" loading={submitting} onClick={handleSubmit} className="h-16 text-lg rounded-2xl shadow-xl shadow-brand-500/20">
                <div className="flex items-center gap-2">
                  <span>Enviar mi registro</span>
                  <ArrowRight size={20} />
                </div>
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center gap-4 p-5 bg-blue-50 border border-blue-100 rounded-3xl text-blue-800">
           <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shrink-0 shadow-sm text-blue-600">
              <Info size={20} />
           </div>
           <p className="text-xs font-medium leading-relaxed">
             Si viajas con más personas, cada una puede usar este mismo enlace para registrarse. 
             El sistema asignará automáticamente cada registro a la reserva.
           </p>
        </div>
      </div>
    </div>
  )
}
