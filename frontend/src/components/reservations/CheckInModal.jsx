import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  X, Search, UserPlus, Calendar, Bed, Check, Info, Sparkles,
  Building2, User, Users, MapPin, ArrowLeft, ArrowRight,
  CheckCircle, ChevronRight, Plus, Trash2, Globe, Home,
  Wifi, Tv, Coffee, Wind, Lock, Key
} from 'lucide-react'
import api from '../../services/api.client'
import ENDPOINTS from '../../config/api.config'
import { Button, Input, Spinner, Select } from '../ui'
import GuestFormFields from '../guests/GuestFormFields'
import toast from 'react-hot-toast'
import { format, addDays } from 'date-fns'

// ─── Constants ─────────────────────────────────────────────────────────────────
const DOC_TYPES = [
  { value: 'CI', label: 'C.I.' },
  { value: 'PASSPORT', label: 'Pasaporte' },
  { value: 'FOREIGN_ID', label: 'Doc. Extranjero' },
]
const CIVIL_STATUS = ['Soltero', 'Casado', 'Divorciado', 'Viudo', 'Unión Libre']
const GENDERS = [{ value: 'M', label: 'Masculino' }, { value: 'F', label: 'Femenino' }, { value: 'OTHER', label: 'Otro' }]

const AMENITY_ICONS = {
  'Wifi': <Wifi size={14} />,
  'Tv': <Tv size={14} />,
  'Coffee': <Coffee size={14} />,
  'Wind': <Wind size={14} />,
  'Lock': <Lock size={14} />,
}

function emptyGuest() {
  return {
    _tempId: Date.now() + Math.random(),
    _mode: 'new', // 'new' | 'search'
    _saved: false,
    // search state
    _searchQuery: '',
    _searchResults: [],
    _searching: false,
    // form data (new or loaded from search)
    id: null, // null = new guest to create
    first_name: '',
    last_name: '',
    doc_type: 'CI',
    doc_number: '',
    email: '',
    phone: '',
    nationality: '',
    gender: 'M',
    birth_date: '',
    civil_status: 'Soltero',
    // trip context (per-stay, not permanent)
    origin_country_code: '',
    origin_country: '',
    origin_city: '',
  }
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function StepIndicator({ step }) {
  const steps = [
    { n: 1, label: 'Habitación', icon: <Bed size={15} /> },
    { n: 2, label: 'Huéspedes', icon: <Users size={15} /> },
    { n: 3, label: 'Registro', icon: <User size={15} /> },
    { n: 4, label: 'Confirmar', icon: <CheckCircle size={15} /> },
  ]
  return (
    <div className="hidden md:flex flex-col w-44 bg-surface-50 border-r border-surface-100 p-6 shrink-0">
      <div className="space-y-5">
        {steps.map((s) => {
          const active = step === s.n
          const done = step > s.n
          return (
            <div key={s.n} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all
                ${done ? 'bg-emerald-500 text-white' : active ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/30' : 'bg-surface-200 text-surface-500'}`}>
                {done ? <Check size={14} /> : s.n}
              </div>
              <span className={`text-xs font-bold uppercase tracking-wider transition-colors
                ${active ? 'text-surface-900' : done ? 'text-emerald-600' : 'text-surface-400'}`}>
                {s.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RoomTypeDetailsModal({ rt, isOpen, onClose }) {
  if (!isOpen || !rt) return null
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-surface-950/60 backdrop-blur-md animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-[24px] shadow-2xl overflow-hidden animate-zoom-in border border-surface-200">
        <div className="p-6 border-b border-surface-100 flex justify-between items-center bg-surface-50">
          <div>
            <h3 className="font-heading font-bold text-lg text-surface-900">{rt.name}</h3>
            <p className="text-xs text-surface-500">Detalles de la categoría</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-200 rounded-xl transition-colors text-surface-400">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-6">
          {rt.description && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-surface-400 uppercase tracking-wider">Descripción</p>
              <p className="text-sm text-surface-600 leading-relaxed">{rt.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-xs font-bold text-surface-400 uppercase tracking-wider">Distribución</p>
              <div className="space-y-1.5">
                {rt.beds?.map(bed => (
                  <div key={bed.id} className="flex items-center gap-2 text-sm text-surface-700">
                    <Bed size={14} className="text-brand-500" />
                    <span className="font-bold">{bed.RoomTypeBed?.count || 1}</span> {bed.name}
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold text-surface-400 uppercase tracking-wider">Capacidad</p>
              <div className="flex items-center gap-2 text-sm text-surface-700">
                <Users size={14} className="text-brand-500" />
                Hasta <span className="font-bold">{rt.max_capacity}</span> personas
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-bold text-surface-400 uppercase tracking-wider">Características y Amenidades</p>
            <div className="grid grid-cols-2 gap-2">
              {rt.amenities?.map(amenity => (
                <div key={amenity.id} className="flex items-center gap-2 px-3 py-2 bg-brand-50/50 rounded-xl border border-brand-100/50">
                  <span className="text-brand-600">
                    {AMENITY_ICONS[amenity.icon] || <Sparkles size={14} />}
                  </span>
                  <span className="text-xs font-medium text-brand-900">{amenity.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="p-6 bg-surface-50 border-t border-surface-100 flex items-center justify-between">
          <div>
            <p className="text-xs text-surface-400 font-medium uppercase tracking-widest">Precio Base</p>
            <p className="text-xl font-black text-brand-600">${parseFloat(rt.base_price || 0).toFixed(0)} <span className="text-xs font-normal text-surface-400">/ noche</span></p>
          </div>
          <Button onClick={onClose} variant="primary" className="px-8">Cerrar</Button>
        </div>
      </div>
    </div>
  )
}

function RoomTypeCard({ rt, selected, onSelect, onShowDetails, availInfo }) {
  const isSelected = selected?.id === rt.id
  const avail = availInfo[rt.id]
  return (
    <button
      type="button"
      onClick={() => onSelect(rt)}
      className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 group relative
        ${isSelected
          ? 'border-brand-500 bg-brand-50 shadow-lg shadow-brand-500/10'
          : 'border-surface-200 bg-white hover:border-brand-300 hover:shadow-md'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={`font-bold text-sm truncate ${isSelected ? 'text-brand-700' : 'text-surface-900'}`}>{rt.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            {rt.beds?.map(bed => (
              <span key={bed.id} className="inline-flex items-center gap-1 text-[10px] font-bold text-surface-500">
                <Bed size={11} className="text-surface-400" /> {bed.RoomTypeBed?.count || 1} {bed.name}
              </span>
            ))}
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-surface-500">
              <Users size={11} className="text-surface-400" /> Máx. {rt.max_capacity}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0 flex flex-col items-end">
          <p className={`text-sm font-black ${isSelected ? 'text-brand-600' : 'text-surface-700'}`}>
            ${parseFloat(rt.base_price || 0).toFixed(0)}
          </p>
          <p className="text-[10px] text-surface-400 font-medium">por noche</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-hidden">
          {rt.amenities?.map(amenity => (
            <div 
              key={amenity.id} 
              title={amenity.name}
              className="w-7 h-7 rounded-lg bg-surface-100 flex items-center justify-center text-surface-600 border border-surface-200 shrink-0"
            >
              {AMENITY_ICONS[amenity.icon] || <Sparkles size={12} />}
            </div>
          ))}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onShowDetails(rt)
            }}
            className="p-1.5 rounded-lg text-brand-600 hover:bg-brand-100 transition-colors"
            title="Ver más información"
          >
            <Info size={16} />
          </button>
          
          {avail && !avail.loading && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg shrink-0
              ${avail.available ? 'text-emerald-700 bg-emerald-100' : 'text-red-700 bg-red-100'}`}>
              {avail.available ? <Check size={10} /> : <X size={10} />}
              {avail.available ? 'Disponible' : 'Sin cupo'}
            </span>
          )}
          {avail?.loading && <Spinner size={12} className="text-brand-500" />}
        </div>
      </div>
    </button>
  )
}

function PhysicalRoomGrid({ rooms, selectedId, onSelect }) {
  if (!rooms.length) return (
    <p className="text-sm text-surface-400 text-center py-4">No hay habitaciones disponibles para esta categoría.</p>
  )
  return (
    <div className="grid grid-cols-5 gap-2">
      {rooms.map(r => (
        <button
          key={r.id}
          type="button"
          onClick={() => onSelect(r.id)}
          className={`py-2.5 px-2 rounded-xl border-2 text-sm font-bold transition-all
            ${selectedId === r.id
              ? 'bg-brand-600 border-brand-600 text-white shadow-lg shadow-brand-500/20'
              : 'bg-white border-surface-200 text-surface-600 hover:border-brand-400 hover:text-brand-600'}`}
        >
          {r.number}
        </button>
      ))}
    </div>
  )
}

function GuestForm({ guest, onChange, isMain, selectedIds = [] }) {
  const update = (field, val) => {
    // If field is an object, merge it all at once
    if (typeof field === 'object') {
      onChange({ ...guest, ...field })
    } else {
      onChange({ ...guest, [field]: val })
    }
  }

  return (
    <div className="space-y-4">
      {isMain && (
        <div className="flex items-center gap-2 px-3 py-2 bg-brand-50 border border-brand-100 rounded-xl">
          <CheckCircle size={14} className="text-brand-600 shrink-0" />
          <p className="text-xs font-bold text-brand-700">Huésped principal (titular de la habitación)</p>
        </div>
      )}

      {/* Mode toggle */}
      <div className="flex rounded-xl bg-surface-100 p-1 gap-1">
        <button
          type="button"
          onClick={() => onChange({ ...guest, _mode: 'search', _saved: false })}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5
            ${guest._mode === 'search' ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700'}`}
        >
          <Search size={12} /> Huésped existente
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...guest, _mode: 'new', _saved: false, id: null })}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5
            ${guest._mode === 'new' ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700'}`}
        >
          <UserPlus size={12} /> Nuevo huésped
        </button>
      </div>

      {guest._mode === 'search' ? (
        <>
          <GuestSearch guest={guest} onChange={onChange} selectedIds={selectedIds} />
          {guest._saved && (
            <div className="pt-3 border-t border-dashed border-surface-200 space-y-3">
              <p className="text-xs font-bold text-surface-500 uppercase tracking-wider flex items-center gap-1.5">
                <Globe size={12} /> Procedencia del viaje
              </p>
              {/* For existing guests, we still show the origin fields manually or we could use GuestFormFields with only those fields. 
                  Let's just use the GuestFormFields with showOrigin=true for everything to keep it consistent. */}
              <GuestFormFields 
                values={guest} 
                onChange={update} 
                showOrigin={true} 
              />
            </div>
          )}
        </>
      ) : (
        <GuestFormFields 
          values={guest} 
          onChange={update} 
          showOrigin={true} 
        />
      )}
    </div>
  )
}

function GuestSearch({ guest, onChange, selectedIds = [] }) {
  const [query, setQuery] = useState(guest._searchQuery || '')
  const [results, setResults] = useState(guest._searchResults || [])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const t = setTimeout(async () => {
      if (query.length < 2) { setResults([]); return }
      setLoading(true)
      try {
        const data = await api.get(ENDPOINTS.guest.listGuests(`search=${query}`))
        const fetched = data.data || data
        setResults(fetched.filter(r => !selectedIds.includes(r.id)))
      } finally {
        setLoading(false)
      }
    }, 400)
    return () => clearTimeout(t)
  }, [query])

  if (guest._saved && guest.id) {
    return (
      <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
        <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
          <User size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-surface-900 text-sm truncate">{guest.first_name} {guest.last_name}</p>
          <p className="text-xs text-surface-500">{guest.doc_type} {guest.doc_number}</p>
        </div>
        <button
          type="button"
          onClick={() => onChange({ ...guest, _saved: false, id: null, _searchQuery: '', _searchResults: [], first_name: '', last_name: '', doc_number: '', origin_country: '', origin_city: '' })}
          className="p-1 rounded-lg text-surface-400 hover:text-red-500 hover:bg-red-50 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" size={15} />
        <input
          autoFocus
          className="w-full pl-10 pr-4 py-2.5 bg-surface-50 border border-surface-200 rounded-xl text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all"
          placeholder="Nombre, apellido o documento..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>
      {loading && <div className="py-4 flex justify-center"><Spinner size={18} className="text-brand-500" /></div>}
      {!loading && results.length > 0 && (
        <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
          {results.map(g => (
            <button
              key={g.id}
              type="button"
              onClick={() => onChange({
                ...guest,
                _saved: true,
                _mode: 'search',
                id: g.id,
                first_name: g.first_name,
                last_name: g.last_name,
                doc_type: g.doc_type,
                doc_number: g.doc_number,
                email: g.email || '',
                phone: g.phone || '',
                nationality: g.nationality || '',
                gender: g.gender || 'M',
                birth_date: g.birth_date || '',
                civil_status: g.civil_status || 'Soltero',
              })}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-surface-100 bg-white hover:border-brand-400 hover:bg-brand-50/40 transition-all text-left group"
            >
              <div className="w-8 h-8 rounded-full bg-surface-100 flex items-center justify-center text-surface-500 group-hover:bg-brand-100 group-hover:text-brand-600 shrink-0 transition-colors">
                <User size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-surface-900 truncate">{g.first_name} {g.last_name}</p>
                <p className="text-xs text-surface-500">{g.doc_type} {g.doc_number}</p>
              </div>
              <ChevronRight size={14} className="text-surface-300 group-hover:text-brand-500 transition-colors shrink-0" />
            </button>
          ))}
        </div>
      )}
      {!loading && query.length >= 2 && results.length === 0 && (
        <p className="text-xs text-surface-400 text-center py-3">No se encontraron resultados. Usa "Nuevo huésped".</p>
      )}
    </div>
  )
}

// NewGuestFields removed in favor of GuestFormFields

// ─── Main Modal ─────────────────────────────────────────────────────────────────

export default function CheckInModal({ isOpen, onClose, onSuccess }) {
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)

  // Step 1 state
  const [roomTypes, setRoomTypes] = useState([])
  const [loadingTypes, setLoadingTypes] = useState(false)
  const [selectedType, setSelectedType] = useState(null)
  const [physicalRooms, setPhysicalRooms] = useState([])
  const [selectedRoomId, setSelectedRoomId] = useState('')
  const [availInfo, setAvailInfo] = useState({}) // keyed by room_type_id
  const [dates, setDates] = useState({
    check_in: format(new Date(), 'yyyy-MM-dd'),
    check_out: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
  })

  // Details Modal state
  const [detailedRt, setDetailedRt] = useState(null)

  // Step 2 state
  const [adults, setAdults] = useState(1)
  const [children, setChildren] = useState(0)
  const [babies, setBabies] = useState(0) // < 5 years

  // Step 3 state
  const [guests, setGuests] = useState([emptyGuest()])
  const [activeGuestIdx, setActiveGuestIdx] = useState(0)
  const [lendableItems, setLendableItems] = useState([])

  // Derived
  const totalGuests = adults + children + babies
  const maxGuests = selectedType?.max_capacity || 99
  const nights = selectedType && availInfo[selectedType.id]?.nights || 0
  
  const calculateAge = (birthday) => {
    if (!birthday) return 18
    const ageDifMs = Date.now() - new Date(birthday).getTime()
    const ageDate = new Date(ageDifMs)
    return Math.abs(ageDate.getUTCFullYear() - 1970)
  }

  const chargeableCount = useMemo(() => {
    if (step >= 3) {
      // Precision based on registered birth dates
      return guests.filter(g => calculateAge(g.birth_date) >= 5).length
    }
    // Step 2 fallback: Adults + Children (assumed >= 5)
    return adults + children
  }, [guests, step, adults, children])

  const totalPrice = nights * chargeableCount * parseFloat(selectedType?.base_price || 0)
  const selectedRoom = physicalRooms.find(r => r.id === selectedRoomId)

  // Identify the generic "Key" item
  const keyItem = useMemo(() => {
    return lendableItems.find(item => 
      item.name.toLowerCase().includes('llave') || 
      item.name.toLowerCase().includes('tarjeta')
    )
  }, [lendableItems])

  // ─── Load room types on open ────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) { resetAll(); return }
    loadRoomTypes()
    loadLendableItems()
  }, [isOpen])

  const loadRoomTypes = async () => {
    setLoadingTypes(true)
    try {
      const data = await api.get(ENDPOINTS.hotels.listRoomTypes())
      setRoomTypes(data.data || data)
    } catch {
      toast.error('Error al cargar tipos de habitación')
    } finally {
      setLoadingTypes(false)
    }
  }

  const loadLendableItems = async () => {
    try {
      const data = await api.get(ENDPOINTS.hotels.listItems())
      setLendableItems(data.data || data || [])
    } catch (e) {
      console.error('Error loading lendable items:', e)
    }
  }

  // ─── Fetch availability for a room type ────────────────────────────────────
  const fetchAvail = useCallback(async (rt, checkIn, checkOut) => {
    if (!rt || !checkIn || !checkOut) return
    setAvailInfo(prev => ({ ...prev, [rt.id]: { loading: true } }))
    try {
      const qs = `room_type_id=${rt.id}&check_in_date=${checkIn}&check_out_date=${checkOut}`
      const res = await api.get(ENDPOINTS.reservation.checkAvailability(qs))
      const d = res.data || res
      setAvailInfo(prev => ({ ...prev, [rt.id]: { loading: false, available: d.available, nights: d.nights } }))
    } catch {
      setAvailInfo(prev => ({ ...prev, [rt.id]: { loading: false, available: false, nights: 0 } }))
    }
  }, [])

  // ─── When type is selected ──────────────────────────────────────────────────
  const handleSelectType = async (rt) => {
    setSelectedType(rt)
    setSelectedRoomId('')
    if (!availInfo[rt.id]) fetchAvail(rt, dates.check_in, dates.check_out)
    // load physical rooms
    try {
      const data = await api.get(ENDPOINTS.hotels.listRooms(`room_type_id=${rt.id}&status=CLEAN`))
      setPhysicalRooms(data.data || data)
    } catch {
      setPhysicalRooms([])
    }
  }

  // ─── Date change: re-check avail for selected type ─────────────────────────
  useEffect(() => {
    if (selectedType) fetchAvail(selectedType, dates.check_in, dates.check_out)
  }, [dates.check_in, dates.check_out])

  // ─── Step 2: sync guest array with total guest count ───────────────────────
  useEffect(() => {
    setGuests(prev => {
      const count = Math.max(1, totalGuests)
      if (prev.length < count) {
        const extras = Array.from({ length: count - prev.length }, emptyGuest)
        return [...prev, ...extras]
      }
      return prev.slice(0, count)
    })
    setActiveGuestIdx(0)
  }, [totalGuests])

  // ─── Guest update ───────────────────────────────────────────────────────────
  const updateGuest = (idx, data) => {
    setGuests(prev => prev.map((g, i) => i === idx ? data : g))
  }

  // ─── Validation helpers ─────────────────────────────────────────────────────
  const step1Valid = () => {
    if (!selectedType) return false
    const avail = availInfo[selectedType.id]
    if (!avail || !avail.available) return false
    if (!selectedRoomId) return false
    return true
  }

  const step2Valid = () => {
    if (adults < 1) return false
    if (totalGuests > maxGuests) return false
    return true
  }

  const guestValid = (g) => {
    if (g._mode === 'search') return g._saved && !!g.id
    return g.first_name.trim() && g.last_name.trim() && g.doc_number.trim()
  }

  const step3Valid = () => guests.every(guestValid)

  // ─── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      // 1. Create/resolve all guests
      const resolvedGuestIds = []
      for (const g of guests) {
        if (g._mode === 'search' && g.id) {
          // Update origin data for existing guest
          await api.put(ENDPOINTS.guest.updateGuest(g.id), {
            ...(g.origin_country && { notes: `Procede de: ${g.origin_city}, ${g.origin_country}` }),
          })
          resolvedGuestIds.push(g.id)
        } else {
          // Create new guest
          const normalizedGuest = Object.keys(g).reduce((acc, key) => {
            if (key.startsWith('_') || key === 'id' || key === 'origin_country' || key === 'origin_city') return acc
            acc[key] = g[key] === '' ? null : g[key]
            return acc
          }, {})
          const res = await api.post(ENDPOINTS.guest.createGuest(), normalizedGuest)
          const newGuest = res.data || res
          resolvedGuestIds.push(newGuest.id)
        }
      }

      const mainGuestId = resolvedGuestIds[0]
      const additionalGuestIds = [...new Set(resolvedGuestIds.slice(1))].filter(id => id !== mainGuestId)

      // 2. Build origin context from main guest
      const mainGuest = guests[0]
      const originContext = {
        origin_country: mainGuest.origin_country || null,
        origin_city: mainGuest.origin_city || null,
      }

      // 3. Create reservation
      const payload = {
        main_guest_id: mainGuestId,
        additional_guest_ids: additionalGuestIds,
        source: 'WALK_IN',
        status: 'IN_HOUSE',
        ...originContext,
        rooms: [{
          room_type_id: selectedType.id,
          room_type_name: selectedType.name,
          room_id: selectedRoomId,
          room_number: selectedRoom?.number || null,
          check_in_date: dates.check_in,
          check_out_date: dates.check_out,
          rate_per_night: parseFloat(selectedType.base_price || 0),
          adults,
          children,
        }]
      }

      const res = await api.post(ENDPOINTS.reservation.createReservation(), payload)
      const createdRes = res.data || res

      // 4. Auto-grant keys if found in catalog
      if (keyItem && createdRes.rooms) {
        for (const room of createdRes.rooms) {
          try {
            await api.post(ENDPOINTS.reservation.lendItem(), {
              res_room_id: room.id,
              item_id: keyItem.id,
              item_name: keyItem.name,
              quantity: 1
            })
          } catch (e) {
            console.error('Error auto-granting key:', e)
          }
        }
      }

      toast.success('¡Check-in realizado con éxito!')
      onClose()
      if (onSuccess) onSuccess()
    } catch (err) {
      toast.error(err.message || 'Error al procesar el check-in')
    } finally {
      setSubmitting(false)
    }
  }

  const resetAll = () => {
    setStep(1)
    setSelectedType(null)
    setPhysicalRooms([])
    setSelectedRoomId('')
    setAvailInfo({})
    setDates({ check_in: format(new Date(), 'yyyy-MM-dd'), check_out: format(addDays(new Date(), 1), 'yyyy-MM-dd') })
    setAdults(1)
    setChildren(0)
    setBabies(0)
    setGuests([emptyGuest()])
    setActiveGuestIdx(0)
  }

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-surface-950/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-3xl rounded-[32px] shadow-2xl overflow-hidden animate-zoom-in border border-surface-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-surface-900 px-8 py-6 relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <Sparkles className="text-white w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-heading font-bold text-white leading-none">Check-in Presencial</h2>
                <p className="text-surface-400 text-sm mt-1">Registro completo de huéspedes en mostrador.</p>
              </div>
            </div>
            {/* Mobile step indicator */}
            <div className="flex items-center gap-3">
              <div className="md:hidden flex items-center gap-1">
                {[1, 2, 3, 4].map(n => (
                  <div key={n} className={`w-2 h-2 rounded-full transition-all ${step === n ? 'bg-emerald-400 w-4' : step > n ? 'bg-emerald-600' : 'bg-surface-600'}`} />
                ))}
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/60 hover:text-white">
                <X size={24} />
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          <StepIndicator step={step} />

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">

              {/* ── STEP 1: Room selection ── */}
              {step === 1 && (
                <div className="space-y-6 animate-fade-up">
                  <div>
                    <h3 className="font-bold text-surface-900 text-lg mb-1">Seleccionar Habitación</h3>
                    <p className="text-sm text-surface-500">Elige la categoría y la habitación disponible.</p>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      type="date"
                      label="Check-in (hoy)"
                      value={dates.check_in}
                      disabled
                    />
                    <Input
                      type="date"
                      label="Check-out"
                      value={dates.check_out}
                      onChange={e => {
                        const newDate = e.target.value
                        if (new Date(newDate) <= new Date(dates.check_in)) {
                          toast.error('La salida debe ser posterior al ingreso')
                          return
                        }
                        setDates(prev => ({ ...prev, check_out: newDate }))
                      }}
                    />
                  </div>

                  {/* Room type list */}
                  <div>
                    <label className="text-sm font-bold text-surface-900 block mb-3">Categoría de Habitación</label>
                    {loadingTypes ? (
                      <div className="flex justify-center py-8"><Spinner className="text-brand-500" /></div>
                    ) : (
                      <div className="space-y-2">
                        {roomTypes.map(rt => (
                          <RoomTypeCard
                            key={rt.id}
                            rt={rt}
                            selected={selectedType}
                            onSelect={handleSelectType}
                            onShowDetails={setDetailedRt}
                            availInfo={availInfo}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <RoomTypeDetailsModal 
                    rt={detailedRt} 
                    isOpen={!!detailedRt} 
                    onClose={() => setDetailedRt(null)} 
                  />

                  {/* Physical rooms */}
                  {selectedType && (
                    <div className="animate-fade-in">
                      <label className="text-sm font-bold text-surface-900 block mb-3">
                        Asignar Habitación Física
                        {!selectedRoomId && <span className="ml-2 text-xs font-medium text-surface-400">(obligatorio para walk-in)</span>}
                      </label>
                      <PhysicalRoomGrid
                        rooms={physicalRooms}
                        selectedId={selectedRoomId}
                        onSelect={setSelectedRoomId}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* ── STEP 2: Guest count ── */}
              {step === 2 && (
                <div className="space-y-6 animate-fade-up">
                  <div>
                    <h3 className="font-bold text-surface-900 text-lg mb-1">¿Cuántos huéspedes son?</h3>
                    <p className="text-sm text-surface-500">
                      Capacidad máxima de <strong>{selectedType?.name}</strong>:{' '}
                      <span className="font-bold text-surface-900">{maxGuests} personas</span>
                    </p>
                  </div>

                  {/* Room summary */}
                  <div className="flex items-center gap-4 p-4 bg-surface-50 rounded-2xl border border-surface-200">
                    <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 shrink-0">
                      <Bed size={18} />
                    </div>
                    <div>
                      <p className="font-bold text-surface-900 text-sm">{selectedType?.name} — Habitación {selectedRoom?.number}</p>
                      <p className="text-xs text-surface-500">{dates.check_in} → {dates.check_out} · ${parseFloat(selectedType?.base_price || 0).toFixed(0)}/noche</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="flex flex-col items-center gap-3 p-5 bg-surface-50 rounded-2xl border border-surface-200">
                      <p className="text-xs font-bold text-surface-500 uppercase tracking-wider">Adultos</p>
                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          onClick={() => setAdults(a => Math.max(1, a - 1))}
                          className="w-9 h-9 rounded-full bg-white border border-surface-200 flex items-center justify-center text-surface-700 hover:border-brand-400 hover:text-brand-600 transition-all font-bold text-lg"
                        >−</button>
                        <span className="text-3xl font-black text-surface-900 w-8 text-center">{adults}</span>
                        <button
                          type="button"
                          onClick={() => setAdults(a => Math.min(maxGuests - children, a + 1))}
                          className="w-9 h-9 rounded-full bg-white border border-surface-200 flex items-center justify-center text-surface-700 hover:border-brand-400 hover:text-brand-600 transition-all font-bold text-lg"
                        >+</button>
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-3 p-5 bg-surface-50 rounded-2xl border border-surface-200">
                      <p className="text-xs font-bold text-surface-500 uppercase tracking-wider">Niños (5-12)</p>
                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          onClick={() => setChildren(c => Math.max(0, c - 1))}
                          className="w-9 h-9 rounded-full bg-white border border-surface-200 flex items-center justify-center text-surface-700 hover:border-brand-400 hover:text-brand-600 transition-all font-bold text-lg"
                        >−</button>
                        <span className="text-3xl font-black text-surface-900 w-8 text-center">{children}</span>
                        <button
                          type="button"
                          onClick={() => setChildren(c => Math.min(maxGuests - adults, c + 1))}
                          className="w-9 h-9 rounded-full bg-white border border-surface-200 flex items-center justify-center text-surface-700 hover:border-brand-400 hover:text-brand-600 transition-all font-bold text-lg"
                        >+</button>
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-3 p-5 bg-surface-50 rounded-2xl border border-surface-200 col-span-2">
                      <p className="text-xs font-bold text-surface-500 uppercase tracking-wider">Bebés (0-4) — Gratis</p>
                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          onClick={() => setBabies(b => Math.max(0, b - 1))}
                          className="w-9 h-9 rounded-full bg-white border border-surface-200 flex items-center justify-center text-surface-700 hover:border-brand-400 hover:text-brand-600 transition-all font-bold text-lg"
                        >−</button>
                        <span className="text-3xl font-black text-surface-900 w-8 text-center">{babies}</span>
                        <button
                          type="button"
                          onClick={() => setBabies(b => b + 1)} // Babies don't count for capacity usually, but let's keep it reasonable
                          className="w-9 h-9 rounded-full bg-white border border-surface-200 flex items-center justify-center text-surface-700 hover:border-brand-400 hover:text-brand-600 transition-all font-bold text-lg"
                        >+</button>
                      </div>
                    </div>
                  </div>

                  {/* Capacity warning */}
                  {totalGuests > maxGuests && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl animate-fade-in">
                      <Info size={14} className="text-red-500 shrink-0" />
                      <p className="text-xs font-bold text-red-600">
                        La capacidad máxima es de {maxGuests} huéspedes. Reduce el número o elige otra categoría.
                      </p>
                    </div>
                  )}

                  {totalGuests <= maxGuests && totalGuests > 0 && (
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                      <p className="text-xs font-bold text-emerald-700">
                        {adults} adulto{adults !== 1 ? 's' : ''}{children > 0 ? ` y ${children} niño${children !== 1 ? 's' : ''}` : ''} — dentro de la capacidad.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ── STEP 3: Guest registration ── */}
              {step === 3 && (
                <div className="space-y-5 animate-fade-up">
                  <div>
                    <h3 className="font-bold text-surface-900 text-lg mb-1">Registro de Huéspedes</h3>
                    <p className="text-sm text-surface-500">Complete la información de cada huésped.</p>
                  </div>

                  {/* Guest tabs */}
                  {guests.length > 1 && (
                    <div className="flex gap-2 flex-wrap">
                      {guests.map((g, i) => (
                        <button
                          key={g._tempId}
                          type="button"
                          onClick={() => setActiveGuestIdx(i)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border
                            ${activeGuestIdx === i
                              ? 'bg-surface-900 border-surface-900 text-white'
                              : guestValid(g)
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                : 'bg-white border-surface-200 text-surface-600 hover:border-surface-300'}`}
                        >
                          {guestValid(g) && <Check size={11} />}
                          {i === 0 ? 'Titular' : `Hués. ${i + 1}`}
                          {g.first_name && <span className="opacity-70">({g.first_name})</span>}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="border border-surface-200 rounded-2xl p-5">
                    <GuestForm
                      guest={guests[activeGuestIdx]}
                      onChange={(data) => updateGuest(activeGuestIdx, data)}
                      isMain={activeGuestIdx === 0}
                      selectedIds={guests.filter((_, i) => i !== activeGuestIdx).map(g => g.id).filter(Boolean)}
                    />
                  </div>

                  {/* Navigate between guests */}
                  {guests.length > 1 && (
                    <div className="flex justify-between items-center text-xs font-bold text-surface-500">
                      {activeGuestIdx > 0 ? (
                        <button type="button" onClick={() => setActiveGuestIdx(i => i - 1)} className="flex items-center gap-1 hover:text-surface-900 transition-colors">
                          <ArrowLeft size={13} /> Anterior
                        </button>
                      ) : <span />}
                      <span>{activeGuestIdx + 1} / {guests.length}</span>
                      {activeGuestIdx < guests.length - 1 ? (
                        <button type="button" onClick={() => setActiveGuestIdx(i => i + 1)} className="flex items-center gap-1 hover:text-surface-900 transition-colors">
                          Siguiente <ArrowRight size={13} />
                        </button>
                      ) : <span />}
                    </div>
                  )}
                </div>
              )}

              {/* ── STEP 4: Confirmation ── */}
              {step === 4 && (
                <div className="space-y-5 animate-fade-up">
                  <div>
                    <h3 className="font-bold text-surface-900 text-lg mb-1">Confirmar Check-in</h3>
                    <p className="text-sm text-surface-500">Revisa el resumen antes de confirmar.</p>
                  </div>

                  {/* Room summary */}
                  <div className="bg-surface-50 border border-surface-200 rounded-2xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-surface-100 flex items-center gap-2">
                      <Bed size={14} className="text-brand-600" />
                      <span className="text-xs font-bold text-surface-700 uppercase tracking-wider">Habitación</span>
                    </div>
                    <div className="px-5 py-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      <div><span className="text-surface-400 text-xs">Categoría</span><p className="font-bold text-surface-900">{selectedType?.name}</p></div>
                      <div><span className="text-surface-400 text-xs">Número</span><p className="font-bold text-surface-900">{selectedRoom?.number || '—'}</p></div>
                      <div><span className="text-surface-400 text-xs">Check-in</span><p className="font-bold text-surface-900">{dates.check_in}</p></div>
                      <div><span className="text-surface-400 text-xs">Check-out</span><p className="font-bold text-surface-900">{dates.check_out}</p></div>
                      <div><span className="text-surface-400 text-xs">Noches</span><p className="font-bold text-surface-900">{nights}</p></div>
                      <div><span className="text-surface-400 text-xs">Tarifa/noche</span><p className="font-bold text-surface-900">${parseFloat(selectedType?.base_price || 0).toFixed(2)}</p></div>
                    </div>
                  </div>

                  {/* Guests summary */}
                  <div className="bg-surface-50 border border-surface-200 rounded-2xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-surface-100 flex items-center gap-2">
                      <Users size={14} className="text-brand-600" />
                      <span className="text-xs font-bold text-surface-700 uppercase tracking-wider">
                        Huéspedes ({adults} adulto{adults !== 1 ? 's' : ''}{children > 0 ? `, ${children} niño${children !== 1 ? 's' : ''}` : ''})
                      </span>
                    </div>
                    <div className="divide-y divide-surface-100">
                      {guests.map((g, i) => (
                        <div key={g._tempId} className="px-5 py-3 flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-surface-200 flex items-center justify-center text-surface-600 shrink-0">
                            <User size={13} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-surface-900 truncate">
                              {g.first_name} {g.last_name}
                              {i === 0 && <span className="ml-2 text-[10px] font-normal text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-md">Titular</span>}
                            </p>
                            <p className="text-xs text-surface-500">{g.doc_type} {g.doc_number}
                              {g.origin_city && ` · Procede de ${g.origin_city}, ${g.origin_country}`}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Total */}
                  <div className="bg-surface-900 rounded-2xl p-5 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-surface-400 uppercase tracking-widest leading-none mb-1">Total estimado</p>
                      <p className="text-3xl font-heading font-black text-white">${totalPrice.toFixed(2)}</p>
                      <p className="text-xs text-surface-500 mt-1">
                        {nights} noche{nights !== 1 ? 's' : ''} × {chargeableCount} huésped{chargeableCount !== 1 ? 'es' : ''} × ${parseFloat(selectedType?.base_price || 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                      <CheckCircle className="text-white w-7 h-7" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer navigation */}
            <div className="px-8 py-5 border-t border-surface-100 flex gap-3 shrink-0">
              {step > 1 && (
                <Button variant="secondary" onClick={() => setStep(s => s - 1)} className="flex items-center gap-2">
                  <ArrowLeft size={15} /> Atrás
                </Button>
              )}

              {step < 4 && (
                <Button
                  variant="primary"
                  className="flex-1 flex items-center justify-center gap-2"
                  disabled={
                    (step === 1 && !step1Valid()) ||
                    (step === 2 && !step2Valid()) ||
                    (step === 3 && !step3Valid())
                  }
                  onClick={() => setStep(s => s + 1)}
                >
                  Continuar <ArrowRight size={15} />
                </Button>
              )}

              {step === 4 && (
                <Button
                  variant="success"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center gap-2"
                  loading={submitting}
                  onClick={handleSubmit}
                >
                  <CheckCircle size={16} /> Confirmar Check-in
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.getElementById('modal-root')
  )
}
