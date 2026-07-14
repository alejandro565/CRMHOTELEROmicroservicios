import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api.client'
import ENDPOINTS from '../../config/api.config'
import { Spinner } from '../../components/ui'
import toast from 'react-hot-toast'
import {
  Bed, Search, X, Users, LogOut, Wrench, CheckCircle,
  RefreshCcw, AlertTriangle, User, Calendar,
  ArrowRight, Layers, Sparkles, Building2, Receipt
} from 'lucide-react'
import FolioModal from '../../components/billing/FolioModal'

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG = {
  CLEAN:       { label: 'Limpia',        color: 'emerald', bg: 'bg-emerald-500',  ring: 'ring-emerald-400', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
  DIRTY:       { label: 'Sucia',         color: 'amber',   bg: 'bg-amber-400',    ring: 'ring-amber-400',   text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700' },
  OCCUPIED:    { label: 'Ocupada',       color: 'blue',    bg: 'bg-brand-500',    ring: 'ring-brand-400',   text: 'text-brand-700',   badge: 'bg-brand-100 text-brand-700' },
  MAINTENANCE: { label: 'Mantenimiento', color: 'red',     bg: 'bg-red-500',      ring: 'ring-red-400',     text: 'text-red-700',     badge: 'bg-red-100 text-red-700' },
}

const STATUS_ICON = {
  CLEAN:       <CheckCircle size={13} />,
  DIRTY:       <Sparkles size={13} />,
  OCCUPIED:    <Users size={13} />,
  MAINTENANCE: <Wrench size={13} />,
}

// ─── Room Card ────────────────────────────────────────────────────────────────
function RoomCard({ room, isSelected, isHighlighted, onClick }) {
  const cfg  = STATUS_CFG[room.status] || STATUS_CFG.CLEAN
  const dimmed = !isHighlighted && isHighlighted !== null  // search active but not matched

  // Premium tailored style configs with gradients, borders and shadow accents
  const styleMap = {
    CLEAN: {
      grad: 'from-emerald-500/10 to-teal-500/5 hover:from-emerald-500/20 hover:to-teal-500/10',
      selGrad: 'from-emerald-600 to-teal-600 border-emerald-400 shadow-emerald-500/20',
      border: 'border-emerald-500/20 hover:border-emerald-500/40',
      iconColor: 'text-emerald-500',
    },
    DIRTY: {
      grad: 'from-amber-500/10 to-orange-500/5 hover:from-amber-500/20 hover:to-orange-500/10',
      selGrad: 'from-amber-500 to-orange-500 border-amber-400 shadow-amber-500/20',
      border: 'border-amber-500/20 hover:border-amber-500/40',
      iconColor: 'text-amber-500',
    },
    OCCUPIED: {
      grad: 'from-blue-500/10 to-indigo-500/5 hover:from-blue-500/20 hover:to-indigo-500/10',
      selGrad: 'from-blue-600 to-indigo-600 border-blue-400 shadow-blue-500/20',
      border: 'border-blue-500/20 hover:border-blue-500/40',
      iconColor: 'text-brand-500',
    },
    MAINTENANCE: {
      grad: 'from-red-500/10 to-rose-500/5 hover:from-red-500/20 hover:to-rose-500/10',
      selGrad: 'from-red-600 to-rose-600 border-red-400 shadow-red-500/20',
      border: 'border-red-500/20 hover:border-red-500/40',
      iconColor: 'text-red-500',
    }
  }

  const design = styleMap[room.status] || styleMap.CLEAN
  const icon = STATUS_ICON[room.status] || STATUS_ICON.CLEAN

  return (
    <button
      onClick={() => onClick(room)}
      className={`
        relative flex flex-col items-center justify-between p-4 min-h-[110px] rounded-2xl border-2
        transition-all duration-300 cursor-pointer select-none group
        ${isSelected
          ? `bg-gradient-to-br ${design.selGrad} text-white border-2 scale-105 shadow-xl`
          : isHighlighted
            ? `bg-white border-brand-500 ring-4 ring-brand-400/20 scale-105 shadow-lg`
            : dimmed
              ? 'opacity-30 border-surface-200 bg-surface-50'
              : `bg-gradient-to-br ${design.grad} ${design.border} hover:shadow-lg hover:scale-[1.03]`
        }
      `}
    >
      {/* Top row: floor indicator & status icon */}
      <div className="w-full flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
        <span className={isSelected ? 'text-white/70' : 'text-surface-400'}>
          Piso {room.floor}
        </span>
        <div className={`p-1.5 rounded-lg transition-colors ${isSelected ? 'bg-white/20 text-white' : `bg-white ${design.iconColor} shadow-sm border border-surface-100`}`}>
          {icon}
        </div>
      </div>

      {/* Center row: Room number */}
      <div className="my-1 text-center">
        <span className={`text-2xl font-black tracking-tight leading-none ${isSelected ? 'text-white' : 'text-surface-900'}`}>
          {room.number}
        </span>
      </div>

      {/* Bottom row: Room type & status text */}
      <div className="w-full text-center">
        <p className={`text-[9px] font-extrabold uppercase tracking-widest line-clamp-1
          ${isSelected ? 'text-white/80' : 'text-surface-500'}`}>
          {room.type?.split(' ')[0] || '—'}
        </p>
      </div>

      {/* Highlight pulse for search result */}
      {isHighlighted && (
        <span className="absolute inset-0 rounded-2xl border-2 border-brand-500 animate-pulse pointer-events-none" />
      )}
    </button>
  )
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.CLEAN
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${cfg.badge}`}>
      {STATUS_ICON[status]}
      {cfg.label}
    </span>
  )
}

// ─── Room Detail Panel ────────────────────────────────────────────────────────
function RoomDetailPanel({ room, reservation, loadingRes, onClose, onRefresh, onOpenFolio }) {
  const qc = useQueryClient()

  const changeStatus = useMutation({
    mutationFn: ({ status }) => api.patch(ENDPOINTS.hotels.changeRoomStatus(room.id), { status }),
    onSuccess: () => { qc.invalidateQueries(['hk-rack']); toast.success('Estado actualizado'); onRefresh() },
    onError: (e) => toast.error(e.message || 'Error al cambiar estado'),
  })

  const checkOut = useMutation({
    mutationFn: () => api.post(ENDPOINTS.reservation.checkOut(reservation?.id), {}),
    onSuccess: () => {
      qc.invalidateQueries(['hk-rack'])
      qc.invalidateQueries(['reservations'])
      toast.success('¡Check-out realizado!')
      onRefresh()
    },
    onError: (e) => toast.error(e.message || 'Error al realizar check-out'),
  })

  const cfg = STATUS_CFG[room.status] || STATUS_CFG.CLEAN

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1" />
      <div
        className="w-full max-w-sm bg-white h-full shadow-2xl border-l border-surface-100 flex flex-col animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Panel header */}
        <div className="bg-surface-900 px-6 py-5 flex items-start justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-3 h-3 rounded-full ${cfg.bg}`} />
              <p className="text-surface-400 text-xs font-bold uppercase tracking-widest">Habitación</p>
            </div>
            <h2 className="text-3xl font-black text-white leading-none">#{room.number}</h2>
            <p className="text-surface-400 text-sm mt-1">{room.type || 'Sin categoría'} · Piso {room.floor}</p>
          </div>
          <button onClick={onClose} className="text-surface-400 hover:text-white p-1 rounded-lg hover:bg-surface-800 transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Status bar */}
        <div className="px-6 py-3 border-b border-surface-100 flex items-center justify-between shrink-0">
          <StatusBadge status={room.status} />
          {room.status !== 'OCCUPIED' && (
            <div className="flex gap-2">
              {room.status !== 'CLEAN' && (
                <button
                  onClick={() => changeStatus.mutate({ status: 'CLEAN' })}
                  disabled={changeStatus.isPending}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-all flex items-center gap-1"
                >
                  <CheckCircle size={12} /> Limpia
                </button>
              )}
              {room.status !== 'DIRTY' && room.status !== 'MAINTENANCE' && (
                <button
                  onClick={() => changeStatus.mutate({ status: 'DIRTY' })}
                  disabled={changeStatus.isPending}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition-all flex items-center gap-1"
                >
                  <Sparkles size={12} /> Sucia
                </button>
              )}
              {room.status !== 'MAINTENANCE' && (
                <button
                  onClick={() => changeStatus.mutate({ status: 'MAINTENANCE' })}
                  disabled={changeStatus.isPending}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-all flex items-center gap-1"
                >
                  <Wrench size={12} /> Mant.
                </button>
              )}
            </div>
          )}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">

          {/* Reservation info (if occupied) */}
          {room.status === 'OCCUPIED' && (
            <>
              {loadingRes ? (
                <div className="flex justify-center py-8"><Spinner className="text-brand-500" /></div>
              ) : reservation ? (
                <>
                  {/* Dates */}
                  <div className="bg-brand-50 border border-brand-100 rounded-2xl p-4 space-y-3">
                    <p className="text-xs font-bold text-brand-700 uppercase tracking-widest flex items-center gap-2">
                      <Calendar size={12} /> Estadía activa
                    </p>
                    {reservation.rooms?.map(rr => (
                      <div key={rr.id} className="flex items-center gap-3 text-sm">
                        <div className="flex-1">
                          <p className="font-bold text-surface-900">{rr.room_type_name}</p>
                          <div className="flex items-center gap-1 text-surface-500 text-xs mt-0.5">
                            <span>{rr.check_in_date}</span>
                            <ArrowRight size={10} />
                            <span>{rr.check_out_date}</span>
                          </div>
                        </div>
                        <span className="font-black text-surface-900 text-sm">
                          ${parseFloat(rr.rate_per_night || 0).toFixed(0)}<span className="text-xs font-medium text-surface-400">/n</span>
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Guests */}
                  <div>
                    <p className="text-xs font-bold text-surface-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <Users size={12} /> Huéspedes
                    </p>
                    {/* Main guest — enriched */}
                    <div className="flex items-center gap-3 p-3 bg-brand-50 border border-brand-200 rounded-xl mb-2">
                      <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center shrink-0 font-bold">
                        <User size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        {reservation._guest ? (
                          <>
                            <p className="font-bold text-sm text-surface-900 truncate">
                              {reservation._guest.first_name} {reservation._guest.last_name}
                            </p>
                            <p className="text-xs text-surface-500">
                              {reservation._guest.doc_type} {reservation._guest.doc_number}
                            </p>
                          </>
                        ) : (
                          <p className="font-bold text-sm text-surface-900 truncate font-mono">
                            ID: {reservation.main_guest_id?.slice(0, 14)}…
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-brand-600 bg-brand-100 border border-brand-200 px-2 py-1 rounded-lg shrink-0">
                        Titular
                      </span>
                    </div>
                    {/* Additional guests */}
                    <div className="space-y-1.5">
                      {(reservation.rooms?.[0]?.guests?.slice(1) || []).map((g, i) => (
                        <div key={g.id} className="flex items-center gap-3 p-2.5 bg-surface-50 border border-surface-100 rounded-xl">
                          <div className="w-7 h-7 rounded-full bg-surface-200 text-surface-600 flex items-center justify-center shrink-0 text-xs font-bold">
                            {i + 2}
                          </div>
                          <p className="text-sm text-surface-700 font-mono truncate">
                            {(g.guest_id || g.id || '—').slice(0, 14)}…
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pricing */}
                  <div className="bg-surface-900 rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-surface-400 uppercase tracking-widest font-bold">Total reserva</p>
                      <p className="text-2xl font-black text-white">${parseFloat(reservation.total_price || 0).toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-surface-500 uppercase tracking-widest">Descuento</p>
                      <p className="text-sm font-bold text-emerald-400">
                        {((reservation.discount_applied || 0) * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>

                  {/* CHECKOUT action */}
                  <button
                    onClick={() => {
                      if (window.confirm(`¿Confirmar check-out de la habitación ${room.number}?\n\nAsegúrate que el folio esté saldado.`)) {
                        checkOut.mutate()
                      }
                    }}
                    disabled={checkOut.isPending}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                  >
                    {checkOut.isPending ? <Spinner size={18} className="text-white" /> : <LogOut size={18} />}
                    Realizar Check-out
                  </button>

                  <p className="text-[10px] text-surface-400 text-center">
                    El check-out requiere saldo en cero y sin préstamos pendientes
                  </p>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <AlertTriangle size={28} className="text-amber-400" />
                  <p className="text-sm font-bold text-surface-700">No se encontró la reserva activa</p>
                  <p className="text-xs text-surface-400">La habitación aparece ocupada pero no hay reserva IN_HOUSE asociada</p>
                </div>
              )}
            </>
          )}

          {/* Maintenance notes placeholder */}
          {room.status === 'MAINTENANCE' && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-bold text-red-700 uppercase tracking-widest flex items-center gap-2">
                <Wrench size={12} /> En mantenimiento
              </p>
              <p className="text-sm text-red-600">
                Esta habitación está bloqueada para uso. Cuando el mantenimiento termine, cambia el estado a <strong>Limpia</strong>.
              </p>
              <button
                onClick={() => changeStatus.mutate({ status: 'CLEAN' })}
                disabled={changeStatus.isPending}
                className="mt-2 w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-sm"
              >
                <CheckCircle size={15} /> Marcar como Limpia
              </button>
            </div>
          )}

          {/* Empty / Clean / Dirty state */}
          {(room.status === 'CLEAN' || room.status === 'DIRTY') && (
            <div className="text-center py-6 space-y-2">
              <div className={`w-14 h-14 rounded-full mx-auto flex items-center justify-center ${room.status === 'CLEAN' ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                {room.status === 'CLEAN'
                  ? <CheckCircle size={26} className="text-emerald-500" />
                  : <Sparkles size={26} className="text-amber-500" />
                }
              </div>
              <p className="font-bold text-surface-800 text-sm">
                {room.status === 'CLEAN' ? 'Habitación lista' : 'Requiere limpieza'}
              </p>
              <p className="text-xs text-surface-400">
                {room.status === 'CLEAN'
                  ? 'La habitación está limpia y disponible para recibir huéspedes.'
                  : 'La habitación necesita ser atendida por el equipo de housekeeping.'
                }
              </p>
            </div>
          )}

          {/* Action: View Folio (only if occupied) */}
          {room.status === 'OCCUPIED' && reservation && (
            <div className="pt-2">
              <button 
                onClick={() => onOpenFolio(reservation.id)}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-surface-900 hover:bg-surface-800 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-black/10"
              >
                <Receipt size={16} /> Ver Cuenta (Folio)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RoomsPage() {
  const qc = useQueryClient()
  const [selected, setSelected]         = useState(null)
  const [search, setSearch]             = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [highlightedRooms, setHighlightedRooms] = useState(null) // null = no search active
  const [folioResId, setFolioResId] = useState(null)
  const searchTimeout = useRef(null)

  // ─── Fetch housekeeping rack ──────────────────────────────────────────────
  const { data: rackData, isLoading: rackLoading, refetch: refetchRack } = useQuery({
    queryKey: ['hk-rack'],
    queryFn: () => api.get(ENDPOINTS.hotels.hkRack()),
    refetchInterval: 30_000,
  })

  const floors = rackData?.data || []
  const allRooms = floors.flatMap(f => f.rooms || [])

  // ─── Aggregated counts ────────────────────────────────────────────────────
  const counts = {
    CLEAN:       allRooms.filter(r => r.status === 'CLEAN').length,
    DIRTY:       allRooms.filter(r => r.status === 'DIRTY').length,
    OCCUPIED:    allRooms.filter(r => r.status === 'OCCUPIED').length,
    MAINTENANCE: allRooms.filter(r => r.status === 'MAINTENANCE').length,
  }

  // ─── Fetch active reservation for selected occupied room ──────────────────
  const { data: reservationData, isLoading: resLoading } = useQuery({
    queryKey: ['res-by-room', selected?.id],
    enabled: !!selected && selected.status === 'OCCUPIED',
    queryFn: async () => {
      // listReservations returns { total, page, data: [...] } or just [...]
      const res = await api.get(ENDPOINTS.reservation.listReservations('status=IN_HOUSE&limit=200'))
      const rows = (res.data ?? res)           // paginated: res.data | flat: res
      const list = Array.isArray(rows) ? rows : (rows?.data ?? [])

      const match = list.find(r =>
        r.rooms?.some(rr => rr.room_id === selected.id || rr.room_number === selected.number)
      )
      if (!match) return null

      // Enrich: fetch main guest name
      try {
        const guestRes = await api.get(ENDPOINTS.guest.getGuest(match.main_guest_id))
        const g = guestRes.data || guestRes
        return { ...match, _guest: g }
      } catch (_) {
        return match
      }
    },
  })

  // ─── Guest search logic ───────────────────────────────────────────────────
  const handleSearch = useCallback(async (query) => {
    if (!query.trim()) {
      setHighlightedRooms(null)
      return
    }
    try {
      // Get all IN_HOUSE reservations
      const res = await api.get(ENDPOINTS.reservation.listReservations('status=IN_HOUSE&limit=200'))
      const rows = res.data || res

      // Find matching reservations by guest_id in rooms (guests array)
      // We also try via guest service search
      let matchedRoomNumbers = new Set()

      // Search by guest name via guest service
      try {
        const guestRes = await api.get(ENDPOINTS.guest.listGuests(`search=${encodeURIComponent(query)}`))
        const guests = guestRes.data || guestRes

        const guestIds = new Set(guests.map(g => g.id))

        rows.forEach(res => {
          if (guestIds.has(res.main_guest_id)) {
            res.rooms?.forEach(rr => {
              if (rr.room_number) matchedRoomNumbers.add(rr.room_number)
            })
          }
        })
      } catch (_) {}

      // Also search by room number directly
      if (query.match(/^\d+[A-Za-z]?$/)) {
        matchedRoomNumbers.add(query)
      }

      setHighlightedRooms(matchedRoomNumbers)

      if (matchedRoomNumbers.size === 0) {
        toast('No se encontraron habitaciones para ese huésped', { icon: '🔍' })
      }
    } catch (e) {
      toast.error('Error al buscar huéspedes')
    }
  }, [])

  useEffect(() => {
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      handleSearch(search)
    }, 500)
    return () => clearTimeout(searchTimeout.current)
  }, [search, handleSearch])

  // ─── Filtered rooms list (for status filter in rack) ─────────────────────
  const filteredFloors = floors.map(floor => ({
    ...floor,
    rooms: (floor.rooms || []).filter(r =>
      filterStatus === 'ALL' ? true : r.status === filterStatus
    )
  })).filter(f => f.rooms.length > 0)

  return (
    <div className="min-h-screen bg-surface-50">

      {/* ── Header & Stats Dashboard ── */}
      <div className="bg-white border-b border-surface-100 px-8 py-8">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div>
            <h1 className="text-3xl font-heading font-black text-surface-900 flex items-center gap-3">
              <div className="p-2 bg-brand-500/10 rounded-xl text-brand-600">
                <Bed size={26} />
              </div>
              Inventario de Habitaciones
            </h1>
            <p className="text-surface-500 text-sm mt-1">Estado de infraestructura e inventario físico en tiempo real · Auto-actualiza cada 30s</p>
          </div>
          <button
            onClick={() => refetchRack()}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-surface-700 bg-surface-100 hover:bg-surface-200 rounded-xl transition-all shadow-sm border border-surface-200/50"
          >
            <RefreshCcw size={15} /> Actualizar
          </button>
        </div>

        {/* ── Premium Stats Dashboard ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Occupancy Card */}
          <div className="bg-gradient-to-br from-white to-surface-50/50 border border-surface-100 rounded-2xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-surface-400 font-bold uppercase tracking-widest">Ocupación</p>
              <h3 className="text-3xl font-black text-surface-900 mt-1">
                {allRooms.length ? ((counts.OCCUPIED / allRooms.length) * 100).toFixed(0) : 0}%
              </h3>
              <p className="text-xs text-surface-500 mt-1 font-medium">{counts.OCCUPIED} de {allRooms.length} habitaciones</p>
            </div>
            <div className="w-16 h-16 relative flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path className="text-surface-100" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path className="text-brand-500" strokeWidth="3" strokeDasharray={`${allRooms.length ? ((counts.OCCUPIED / allRooms.length) * 100).toFixed(0) : 0}, 100`} strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              </svg>
              <Users size={16} className="text-brand-500 absolute" />
            </div>
          </div>

          {/* Clean Ratio Card */}
          <div className="bg-gradient-to-br from-white to-surface-50/50 border border-surface-100 rounded-2xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-surface-400 font-bold uppercase tracking-widest">Limpias / Disponibles</p>
              <h3 className="text-3xl font-black text-surface-900 mt-1">
                {allRooms.length ? ((counts.CLEAN / allRooms.length) * 100).toFixed(0) : 0}%
              </h3>
              <p className="text-xs text-surface-500 mt-1 font-medium">{counts.CLEAN} limpias de {allRooms.length}</p>
            </div>
            <div className="w-16 h-16 relative flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path className="text-surface-100" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path className="text-emerald-500" strokeWidth="3" strokeDasharray={`${allRooms.length ? ((counts.CLEAN / allRooms.length) * 100).toFixed(0) : 0}, 100`} strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              </svg>
              <CheckCircle size={16} className="text-emerald-500 absolute" />
            </div>
          </div>

          {/* Dirty Ratio Card */}
          <div className="bg-gradient-to-br from-white to-surface-50/50 border border-surface-100 rounded-2xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-surface-400 font-bold uppercase tracking-widest">Sucias / Limpieza Pendiente</p>
              <h3 className="text-3xl font-black text-surface-900 mt-1">
                {allRooms.length ? ((counts.DIRTY / allRooms.length) * 100).toFixed(0) : 0}%
              </h3>
              <p className="text-xs text-surface-500 mt-1 font-medium">{counts.DIRTY} pendientes de aseo</p>
            </div>
            <div className="w-16 h-16 relative flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path className="text-surface-100" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path className="text-amber-500" strokeWidth="3" strokeDasharray={`${allRooms.length ? ((counts.DIRTY / allRooms.length) * 100).toFixed(0) : 0}, 100`} strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              </svg>
              <Sparkles size={16} className="text-amber-500 absolute" />
            </div>
          </div>

          {/* Maintenance Card */}
          <div className="bg-gradient-to-br from-white to-surface-50/50 border border-surface-100 rounded-2xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-surface-400 font-bold uppercase tracking-widest">Bloqueadas / Mantenimiento</p>
              <h3 className="text-3xl font-black text-surface-900 mt-1">
                {allRooms.length ? ((counts.MAINTENANCE / allRooms.length) * 100).toFixed(0) : 0}%
              </h3>
              <p className="text-xs text-surface-500 mt-1 font-medium">{counts.MAINTENANCE} fuera de servicio</p>
            </div>
            <div className="w-16 h-16 relative flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path className="text-surface-100" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path className="text-red-500" strokeWidth="3" strokeDasharray={`${allRooms.length ? ((counts.MAINTENANCE / allRooms.length) * 100).toFixed(0) : 0}, 100`} strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              </svg>
              <Wrench size={16} className="text-red-500 absolute" />
            </div>
          </div>
        </div>

        {/* ── Status filter summary pills ── */}
        <div className="flex flex-wrap gap-2.5 pt-2 border-t border-surface-100/70">
          {[
            { key: 'ALL', label: 'Todas las habitaciones', count: allRooms.length, color: 'bg-surface-900 border-surface-900 text-white' },
            { key: 'CLEAN',       label: 'Limpias',       count: counts.CLEAN,       color: 'bg-emerald-500 border-emerald-500 text-white' },
            { key: 'OCCUPIED',    label: 'Ocupadas',      count: counts.OCCUPIED,    color: 'bg-brand-500 border-brand-500 text-white' },
            { key: 'DIRTY',       label: 'Sucias',        count: counts.DIRTY,       color: 'bg-amber-500 border-amber-500 text-white' },
            { key: 'MAINTENANCE', label: 'Mantenimiento', count: counts.MAINTENANCE, color: 'bg-red-500 border-red-500 text-white' },
          ].map(({ key, label, count, color }) => (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border-2
                ${filterStatus === key ? `${color} shadow-sm scale-[1.02]` : 'bg-white border-surface-200 text-surface-600 hover:border-surface-300'}`}
            >
              {label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-black
                ${filterStatus === key ? 'bg-white/20 text-white' : 'bg-surface-100 text-surface-600'}`}>
                {count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Search bar ── */}
      <div className="px-8 py-4 bg-white border-b border-surface-100">
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" size={16} />
          <input
            type="text"
            placeholder="Buscar por nombre del huésped o nro. habitación…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-surface-50 border border-surface-200 rounded-xl text-sm text-surface-900 placeholder:text-surface-400 outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10 transition-all"
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setHighlightedRooms(null) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-700 transition-colors"
            >
              <X size={15} />
            </button>
          )}
        </div>
        {highlightedRooms !== null && (
          <p className="text-xs text-brand-600 font-bold mt-2 flex items-center gap-1.5">
            <Sparkles size={11} />
            {highlightedRooms.size > 0
              ? `${highlightedRooms.size} habitación(es) encontrada(s)`
              : 'Sin resultados — mostrando todas'}
          </p>
        )}
      </div>

      {/* ── Rack by floor ── */}
      <div className="px-8 py-6">
        {rackLoading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner className="text-brand-500" size={32} />
          </div>
        ) : allRooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-surface-100 flex items-center justify-center mb-4">
              <Building2 size={32} className="text-surface-400" />
            </div>
            <h3 className="text-lg font-bold text-surface-700 mb-1">Sin habitaciones</h3>
            <p className="text-sm text-surface-400">No hay habitaciones configuradas en este hotel.</p>
          </div>
        ) : filteredFloors.length === 0 ? (
          <div className="text-center py-16 text-surface-400 text-sm font-medium">
            No hay habitaciones con el estado seleccionado.
          </div>
        ) : (
          <div className="space-y-6">
            {filteredFloors.map(floor => (
              <div key={floor.floor} className="bg-white rounded-2xl border border-surface-100 overflow-hidden shadow-sm">
                {/* Floor header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100 bg-surface-50">
                  <div className="flex items-center gap-2">
                    <Layers size={16} className="text-brand-500" />
                    <h3 className="font-bold text-surface-900 text-sm">
                      Piso {floor.floor === 0 ? 'G (Planta Baja)' : floor.floor}
                    </h3>
                    <span className="text-xs text-surface-400 font-medium">· {floor.rooms.length} hab.</span>
                  </div>
                  <div className="flex gap-1.5">
                    {['CLEAN', 'OCCUPIED', 'DIRTY', 'MAINTENANCE'].map(s => {
                      const cnt = floor.rooms.filter(r => r.status === s).length
                      if (!cnt) return null
                      return (
                        <span key={s} className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${STATUS_CFG[s].badge}`}>
                          {cnt} {STATUS_CFG[s].label}
                        </span>
                      )
                    })}
                  </div>
                </div>

                {/* Room grid */}
                <div className="p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                  {floor.rooms.map(room => {
                    const isHighlighted = highlightedRooms !== null
                      ? highlightedRooms.has(room.number)
                      : null
                    return (
                      <RoomCard
                        key={room.id}
                        room={room}
                        isSelected={selected?.id === room.id}
                        isHighlighted={isHighlighted}
                        onClick={(r) => {
                          setSelected(prev => prev?.id === r.id ? null : r)
                        }}
                      />
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Legend ── */}
      <div className="px-8 pb-8">
        <div className="flex flex-wrap gap-4 text-xs text-surface-500">
          {Object.entries(STATUS_CFG).map(([k, cfg]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${cfg.bg}`} />
              {cfg.label}
            </span>
          ))}
          <span className="text-surface-400">· Haz clic en una habitación para ver detalles</span>
        </div>
      </div>

      {/* ── Detail Panel ── */}
      {selected && (
        <RoomDetailPanel
          room={selected}
          reservation={reservationData}
          loadingRes={resLoading}
          onClose={() => setSelected(null)}
          onRefresh={() => {
            refetchRack()
            setSelected(null)
          }}
          onOpenFolio={(resId) => { setFolioResId(resId); setSelected(null); }}
        />
      )}

      {/* Folio Modal */}
      <FolioModal 
        isOpen={!!folioResId} 
        onClose={() => setFolioResId(null)}
        reservationId={folioResId}
        onFolioSettled={() => {
          qc.invalidateQueries(['hk-rack'])
          qc.invalidateQueries(['reservations'])
        }}
      />
    </div>
  )
}
