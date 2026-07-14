import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  X, Bed, Check, User, ShoppingCart, Copy, Users, ChevronRight, Tag, ShoppingBag, Calendar, ShieldCheck, Sparkles, UserPlus
} from 'lucide-react'
import api from '../../services/api.client'
import ENDPOINTS from '../../config/api.config'
import { Button, Spinner } from '../ui'
import GuestFormFields from '../guests/GuestFormFields'
import toast from 'react-hot-toast'
import { format, addDays, differenceInCalendarDays } from 'date-fns'
import { Country, City } from 'country-state-city'

import { STEPS, calculateAge, emptyGuest } from './Reservation/constants'
import Step1_RoomSelection from './Reservation/Step1_RoomSelection'
import Step2_Occupancy from './Reservation/Step2_Occupancy'
import Step3_Confirmation from './Reservation/Step3_Confirmation'

function SuccessScreen({ successData, cart, finalGrandTotal, guestPool, copyPortalLink, onClose }) {
  return (
    <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl p-8 text-center flex flex-col items-center animate-zoom-in">
      <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-5">
        <Check size={40} />
      </div>
      <h2 className="text-2xl font-black text-surface-900 mb-1">¡Reserva Completada!</h2>
      <p className="text-surface-500 text-sm mb-5">La reservación ha sido registrada correctamente.</p>

      <div className="w-full bg-surface-50 rounded-2xl p-4 mb-4 text-left space-y-0.5">
        <div className="flex justify-between text-sm">
          <span className="text-surface-600">{cart.length} habitación(es)</span>
          <span className="font-black text-surface-900">Bs {finalGrandTotal.toFixed(2)}</span>
        </div>
        <p className="text-xs text-surface-400">Titular: {guestPool.find(p => p.is_primary)?.guest?.first_name} {guestPool.find(p => p.is_primary)?.guest?.last_name}</p>
      </div>

      {successData.guest_portal_token && (
        <div className="w-full bg-surface-50 rounded-2xl border border-brand-200 p-4 mb-5">
          <h3 className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-1">Portal de Registro Asíncrono</h3>
          <p className="text-xs text-surface-500 mb-3">
            Envía este enlace para que los acompañantes completen sus datos de forma remota.
          </p>
          <div className="flex bg-white border border-surface-200 rounded-xl overflow-hidden">
            <input readOnly value={`${window.location.origin}/portal/${successData.guest_portal_token}`}
              className="flex-1 bg-transparent px-3 py-2 text-xs font-mono text-surface-600 outline-none" />
            <button onClick={copyPortalLink}
              className="bg-brand-500 hover:bg-brand-600 px-4 text-white font-bold text-xs transition-colors flex items-center gap-1.5">
              <Copy size={13} /> Copiar
            </button>
          </div>
        </div>
      )}
      <Button fullWidth onClick={onClose} variant="primary" className="h-12">
        Cerrar y Volver al Sistema
      </Button>
    </div>
  );
}

function QuickCreateModal({ submitting, quickGuest, setQuickGuest, handleQuickCreate, onClose }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden animate-zoom-in">
        <div className="p-6 border-b border-surface-100 flex items-center justify-between bg-surface-50">
          <div>
            <h4 className="font-black text-slate-900 text-lg uppercase tracking-tight">Registro Rápido de Huésped</h4>
            <p className="text-xs text-slate-500">Completa los datos para añadirlo al pool de la reserva.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400 hover:text-slate-900">
            <X size={20}/>
          </button>
        </div>
        <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <GuestFormFields 
            values={quickGuest} 
            onChange={(field, val) => {
              if (typeof field === 'object') setQuickGuest(p => ({ ...p, ...field }));
              else setQuickGuest(p => ({ ...p, [field]: val }));
            }} 
            showOrigin={true}
          />
        </div>
        <div className="p-6 bg-surface-50 border-t border-surface-100 flex gap-3">
          <Button variant="ghost" fullWidth onClick={onClose}>Cancelar</Button>
          <Button variant="primary" fullWidth loading={submitting} onClick={handleQuickCreate} className="h-12 text-base font-bold shadow-lg shadow-brand-500/20">
            Registrar y Añadir al Pool
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ReservationModal({ isOpen, onClose, mode = 'RESERVATION', onSuccess = null }) {
  const isCheckIn = mode === 'CHECK_IN'
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [successData, setSuccessData] = useState(null)

  const [globalDates, setGlobalDates] = useState({
    check_in_date: format(new Date(), 'yyyy-MM-dd'),
    check_out_date: format(addDays(new Date(), 1), 'yyyy-MM-dd')
  })

  const [roomTypes, setRoomTypes] = useState([])
  const [allAvailability, setAllAvailability] = useState({})
  const [roomsLoading, setRoomsLoading] = useState(false)
  const [cart, setCart] = useState([])
  const [physicalRooms, setPhysicalRooms] = useState([])

  const [searchQuery, setSearchQuery] = useState('')
  const [guestResults, setGuestResults] = useState([])
  const [guestLoading, setGuestLoading] = useState(false)
  const [showQuickCreate, setShowQuickCreate] = useState(false)
  const [quickGuest, setQuickGuest] = useState(emptyGuest())
  const [guestPool, setGuestPool] = useState([])

  const [globalDiscountType, setGlobalDiscountType] = useState('NONE')
  const [globalDiscountValue, setGlobalDiscountValue] = useState(0)
  const [notes, setNotes] = useState('')
  const [source, setSource] = useState('PHONE')

  useEffect(() => {
    if (isOpen) {
      loadRoomTypes()
      setSource(isCheckIn ? 'WALK_IN' : 'PHONE')
      loadPhysicalRooms()
    } else {
      resetForm()
    }
  }, [isOpen, isCheckIn])

  const resetForm = () => {
    setStep(1); setSuccessData(null)
    setCart([])
    setGlobalDates({
      check_in_date: format(new Date(), 'yyyy-MM-dd'),
      check_out_date: format(addDays(new Date(), 1), 'yyyy-MM-dd')
    })
    setAllAvailability({})
    setSearchQuery(''); setGuestResults([]); 
    setShowQuickCreate(false)
    setQuickGuest(emptyGuest())
    setPhysicalRooms([])
    setGuestPool([])
    setGlobalDiscountType('NONE')
    setGlobalDiscountValue(0)
    setNotes('')
  }

  const countriesOptions = useMemo(() => {
    const displayNames = new Intl.DisplayNames(['es'], { type: 'region' });
    return Country.getAllCountries().map(c => {
      let name = c.name;
      try { name = displayNames.of(c.isoCode) || c.name; } catch (e) {}
      return { label: name, value: c.isoCode }
    }).sort((a, b) => a.label.localeCompare(b.label, 'es'))
  }, [])

  const getCitiesOptions = (countryCode) => {
    if (!countryCode) return [];
    try {
      return City.getCitiesOfCountry(countryCode).map(c => ({ label: c.name, value: c.name }));
    } catch (e) { return []; }
  };

  const loadRoomTypes = async () => {
    try {
      const data = await api.get(ENDPOINTS.hotels.listRoomTypes())
      setRoomTypes(data.data || data)
    } catch {}
  }

  const loadPhysicalRooms = async () => {
    setRoomsLoading(true)
    try {
      const res = await api.get(ENDPOINTS.hotels.listRooms ? ENDPOINTS.hotels.listRooms() : '/hotels/rooms')
      setPhysicalRooms(res.data || res)
    } catch (err) {
      console.error(err)
    } finally {
      setRoomsLoading(false)
    }
  }

  const updateCartDates = (cin, cout) => {
    if (cart.length === 0) return
    const nights = Math.max(1, differenceInCalendarDays(new Date(cout + 'T12:00'), new Date(cin + 'T12:00')))
    setCart(prev => prev.map(item => ({
      ...item,
      check_in_date: cin,
      check_out_date: cout,
      nights
    })))
  }

  useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd')
    let cin = globalDates.check_in_date
    let cout = globalDates.check_out_date

    if (isCheckIn || new Date(cin) < new Date(today)) {
      cin = today
      if (globalDates.check_in_date !== cin) {
        setGlobalDates(p => ({ ...p, check_in_date: cin }))
      }
    }
    if (new Date(cout) <= new Date(cin)) {
      cout = format(addDays(new Date(cin + 'T12:00'), 1), 'yyyy-MM-dd')
      setGlobalDates(p => ({ ...p, check_out_date: cout }))
    }
    updateCartDates(cin, cout)
  }, [globalDates.check_in_date, globalDates.check_out_date])
  
  // Cleanup guestPool if rooms are removed from cart
  useEffect(() => {
    const cartIds = new Set(cart.map(i => i.id));
    setGuestPool(prev => prev.map(p => 
      p.res_room_id && !cartIds.has(p.res_room_id) 
        ? { ...p, res_room_id: null } 
        : p
    ));
  }, [cart]);

  useEffect(() => {
    if (globalDates.check_in_date && globalDates.check_out_date && roomTypes.length > 0) {
      fetchAllAvailability()
    }
  }, [globalDates.check_in_date, globalDates.check_out_date, roomTypes])

  const fetchAllAvailability = async () => {
    setRoomsLoading(true)
    try {
      const qs = `check_in_date=${globalDates.check_in_date}&check_out_date=${globalDates.check_out_date}`
      const res = await api.get(ENDPOINTS.reservation.checkAvailabilityAll ? ENDPOINTS.reservation.checkAvailabilityAll(qs) : `/reservation/availability/all?${qs}`)
      const data = res.data ?? res
      setAllAvailability(data.availability || {})
    } catch {
      setAllAvailability({})
    } finally {
      setRoomsLoading(false)
    }
  }

  const updateCartItemQuantity = (roomType, delta) => {
    const nights = Math.max(1, differenceInCalendarDays(new Date(globalDates.check_out_date + 'T12:00'), new Date(globalDates.check_in_date + 'T12:00')))
    if (delta > 0) {
      const avail = allAvailability[roomType.id] ?? roomType.total_count
      const currentQty = cart.filter(i => i.room_type_id === roomType.id).length
      if (avail !== undefined && currentQty >= avail) {
        return toast.error('No hay más cupo para este tipo de habitación en las fechas seleccionadas.')
      }
      setCart(prev => [...prev, {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        room_type_id: roomType.id, room_type_name: roomType.name,
        check_in_date: globalDates.check_in_date, check_out_date: globalDates.check_out_date,
        nights, base_rate: parseFloat(roomType.base_price || 0), custom_rate: parseFloat(roomType.base_price || 0),
        max_capacity: roomType.max_capacity, room_id: null, room_number: null,
        adults: 1, children: 0, infants: 0,
      }])
    } else {
      setCart(prev => {
        const idx = prev.map(i => i.room_type_id).lastIndexOf(roomType.id)
        if (idx >= 0) {
          const newCart = [...prev]; newCart.splice(idx, 1); return newCart;
        }
        return prev
      })
    }
  }

  const togglePhysicalRoom = (rt, room) => {
    setCart(prev => {
      const exists = prev.find(i => i.room_id === room.id)
      if (exists) return prev.filter(i => i.room_id !== room.id)
      const nights = Math.max(1, differenceInCalendarDays(new Date(globalDates.check_out_date + 'T12:00'), new Date(globalDates.check_in_date + 'T12:00')))
      return [...prev, {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        room_type_id: rt.id, room_type_name: rt.name,
        check_in_date: globalDates.check_in_date, check_out_date: globalDates.check_out_date,
        nights, base_rate: parseFloat(rt.base_price || 0), custom_rate: parseFloat(rt.base_price || 0),
        max_capacity: rt.max_capacity, room_id: room.id, room_number: room.number,
        adults: 1, children: 0, infants: 0,
      }]
    })
  }

  const removeCartItem = (id) => setCart(p => p.filter(i => i.id !== id))
  
  const getRoomCapacity = (room) => room.max_capacity || 2;
  const getCountableOccupants = (roomId) => guestPool.filter(p => p.res_room_id === roomId && calculateAge(p.guest.birth_date) >= 5).length;

  const updateRoomOccupancy = (roomId, field, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === roomId) {
        const newVal = Math.max(field === 'adults' ? 1 : 0, (item[field] || 0) + delta);
        return { ...item, [field]: newVal };
      }
      return item;
    }));
  };

  const assignGuestToRoom = (guestId, roomId) => {
    if (roomId) {
      const room = cart.find(r => r.id === roomId);
      const capacity = getRoomCapacity(room);
      const guestItem = guestPool.find(p => p.guest.id === guestId);
      const isBaby = calculateAge(guestItem.guest.birth_date) < 5;
      if (!isBaby && getCountableOccupants(roomId) >= capacity) return toast.error(`Capacidad máxima alcanzada (${capacity} personas)`);
    }
    setGuestPool(prev => prev.map(item => item.guest.id === guestId ? { ...item, res_room_id: roomId } : item));
  };

  const setGuestTravelData = (guestId, field, value) => {
    setGuestPool(prev => prev.map(item => item.guest.id === guestId ? { ...item, [field]: value } : item));
  };

  const removeGuestFromPool = (guestId) => setGuestPool(prev => prev.filter(item => item.guest.id !== guestId));
  const markGuestAsPrimary = (guestId) => setGuestPool(prev => prev.map(item => ({ ...item, is_primary: item.guest.id === guestId })));

  const setRoomForCartItem = (cartItemId, roomId, roomNumber) => {
    if (roomId && cart.some(item => item.room_id === roomId && item.id !== cartItemId)) {
      return toast.error('Esta habitación ya está seleccionada en otra partida.');
    }
    setCart(prev => prev.map(item => item.id === cartItemId ? { ...item, room_id: roomId, room_number: roomNumber } : item));
  };

  const getChargeableCount = (itemId) => {
    const roomGuests = guestPool.filter(g => g.res_room_id === itemId);
    const actualChargeable = roomGuests.filter(g => calculateAge(g.guest.birth_date) >= 5).length;
    return Math.max(1, actualChargeable);
  };

  const calculateItemTotal = (item) => {
    const chargeable = getChargeableCount(item.id);
    return (item.custom_rate * chargeable) * item.nights;
  };

  const finalSubtotal = useMemo(() => cart.reduce((acc, item) => acc + calculateItemTotal(item), 0), [cart, guestPool]);
  
  const primaryGuest = useMemo(() => guestPool.find(p => p.is_primary), [guestPool]);
  const loyaltyDiscount = primaryGuest?.guest?.stats?.loyalty_level?.discount_percentage || 0;

  const finalGrandTotal = useMemo(() => {
    let total = finalSubtotal;
    // Apply automatic loyalty discount
    if (loyaltyDiscount > 0) {
      total = total * (1 - loyaltyDiscount);
    }
    // Apply manual global discount
    if (globalDiscountType === 'PERCENTAGE') total = total * (1 - globalDiscountValue / 100);
    else if (globalDiscountType === 'FIXED') total = Math.max(0, total - globalDiscountValue);
    
    return total;
  }, [finalSubtotal, globalDiscountType, globalDiscountValue, loyaltyDiscount]);

  useEffect(() => {
    const t = setTimeout(() => { if (searchQuery.length > 2) doSearchGuests() }, 500)
    return () => clearTimeout(t)
  }, [searchQuery])

  const doSearchGuests = async () => {
    setGuestLoading(true); try {
      const data = await api.get(ENDPOINTS.guest.listGuests(`search=${searchQuery}`))
      setGuestResults(data.data || data)
    } finally { setGuestLoading(false) }
  }

  const handleSelectGuest = (guest) => {
    console.log('[ReservationModal] Selecting guest:', guest);
    if (guestPool.some(p => p.guest.id === guest.id)) return toast.error('Ya está en el pool');
    let targetRoomId = cart.length === 1 && (calculateAge(guest.birth_date) < 5 || getCountableOccupants(cart[0].id) < getRoomCapacity(cart[0])) ? cart[0].id : null;
    setGuestPool(prev => [...prev, { guest, res_room_id: targetRoomId, is_primary: prev.length === 0, origin_country: guest.origin_country || '', origin_city: guest.origin_city || '', origin_country_code: '' }]);
    setSearchQuery(''); setGuestResults([]);
    if (targetRoomId) toast.success(`Asignado automáticamente`);
  }

  const handleQuickCreate = async () => {
    if (!quickGuest.first_name || !quickGuest.last_name || !quickGuest.doc_number) return toast.error('Datos incompletos');
    setSubmitting(true); try {
      const norm = Object.keys(quickGuest).reduce((a, k) => { a[k] = quickGuest[k] === '' ? null : quickGuest[k]; return a }, {})
      const res = await api.post(ENDPOINTS.guest.createGuest(), norm); const g = res.data || res;
      let targetRoomId = cart.length === 1 && (calculateAge(g.birth_date) < 5 || getCountableOccupants(cart[0].id) < getRoomCapacity(cart[0])) ? cart[0].id : null;
      setGuestPool(prev => [...prev, { guest: g, res_room_id: targetRoomId, is_primary: prev.length === 0, origin_country: quickGuest.origin_country || '', origin_city: quickGuest.origin_city || '', origin_country_code: quickGuest.origin_country_code || '' }]);
      setShowQuickCreate(false); setQuickGuest(emptyGuest()); toast.success('Registrado con éxito');
    } catch (err) { toast.error(err.message) } finally { setSubmitting(false) }
  }

  const handleCreate = async () => {
    if (cart.length === 0) return toast.error('Añade una habitación');
    const primary = guestPool.find(p => p.is_primary);
    if (!primary) return toast.error('Selecciona un titular');
    setSubmitting(true); try {
      const payload = {
        main_guest_id: primary.guest.id, source, notes, status: isCheckIn ? 'IN_HOUSE' : 'PRE_CHECKIN',
        total_price_override: Number(finalGrandTotal),
        rooms: cart.map(i => {
          const roomOccupants = guestPool.filter(p => p.res_room_id === i.id);
          const derivedAdults = Math.max(1, roomOccupants.filter(p => calculateAge(p.guest.birth_date) >= 12).length);
          const derivedChildren = roomOccupants.filter(p => { const a = calculateAge(p.guest.birth_date); return a >= 5 && a < 12 }).length;
          const derivedInfants = roomOccupants.filter(p => calculateAge(p.guest.birth_date) < 5).length;

          return {
            room_type_id: i.room_type_id, room_type_name: i.room_type_name, room_id: i.room_id, room_number: i.room_number,
            check_in_date: i.check_in_date, check_out_date: i.check_out_date, rate_per_night: i.custom_rate,
            adults: isCheckIn ? derivedAdults : (i.adults || derivedAdults),
            children: isCheckIn ? derivedChildren : (i.children || derivedChildren),
            infants: isCheckIn ? derivedInfants : (i.infants || derivedInfants),
            guests: roomOccupants.map(p => ({ 
              guest_id: p.guest.id, 
              guest_name: `${p.guest.first_name} ${p.guest.last_name}`, 
              is_primary: p.is_primary, 
              id_verified: isCheckIn,
              origin_country: p.origin_country || null, 
              origin_city: p.origin_city || null 
            }))
          };
        }),
        unassigned_guests: guestPool.filter(p => !p.res_room_id).map(p => ({ 
          guest_id: p.guest.id, 
          id_verified: isCheckIn,
          origin_country: p.origin_country || null, 
          origin_city: p.origin_city || null 
        }))
      };
      const res = await api.post(ENDPOINTS.reservation.createReservation(), payload); 
      toast.success('¡Reserva creada!'); 
      setSuccessData(res.data || res);
      if (onSuccess) onSuccess();
    } catch (err) { toast.error(err.message) } finally { setSubmitting(false) }
  }

  const copyPortalLink = () => { navigator.clipboard.writeText(`${window.location.origin}/portal/${successData.guest_portal_token}`); toast.success('Link copiado') }

  if (!isOpen) return null
  
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-surface-950/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-5xl rounded-[28px] shadow-2xl overflow-hidden border border-surface-200 flex flex-col max-h-[92vh]">
        <div className="bg-surface-900 px-6 py-4 relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl -mr-20 -mt-20" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/30">
                <ShoppingCart className="text-white w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-heading font-bold text-white leading-none">{isCheckIn ? 'Check-in Directo' : 'Nueva Reserva'}</h2>
                <p className="text-surface-400 text-xs mt-0.5">{isCheckIn ? 'Ingreso inmediato presencial' : 'Reserva a futuro · Habitación física opcional'}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/60 hover:text-white"><X size={20} /></button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-40 bg-surface-50 border-r border-surface-100 p-4 hidden md:flex flex-col shrink-0 gap-1.5">
            {STEPS.map(s => (
              <div key={s.n} className={`flex items-center gap-2.5 p-2 rounded-xl transition-all ${step === s.n ? 'bg-brand-50 border border-brand-200' : ''}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${step === s.n ? 'bg-brand-600 text-white shadow' : step > s.n ? 'bg-emerald-500 text-white' : 'bg-surface-200 text-surface-500'}`}>{step > s.n ? <Check size={11} /> : s.n}</div>
                <span className={`text-[11px] font-bold uppercase tracking-wider leading-none ${step >= s.n ? 'text-surface-900' : 'text-surface-400'}`}>{s.label}</span>
              </div>
            ))}
            {cart.length > 0 && (
              <div className="mt-2 border-t border-surface-200 pt-3 space-y-1">
                <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">Carrito</p>
                {cart.map(i => <div key={i.id} className="flex justify-between text-[10px] text-surface-600"><span className="truncate max-w-[70px]">{i.room_type_name}</span><span className="font-bold">Bs {calculateItemTotal(i).toFixed(0)}</span></div>)}
                <div className="flex justify-between text-[10px] font-black text-surface-900 border-t border-surface-200 pt-1 mt-1"><span>TOTAL (pax)</span><span>Bs {finalGrandTotal.toFixed(0)}</span></div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-hidden flex flex-col">
            {successData ? (
              <div className="flex-1 flex items-center justify-center bg-slate-50 p-8">
                <SuccessScreen successData={successData} cart={cart} finalGrandTotal={finalGrandTotal} guestPool={guestPool} copyPortalLink={copyPortalLink} onClose={onClose} />
              </div>
            ) : (
              <>
                {step === 1 && <Step1_RoomSelection isCheckIn={isCheckIn} globalDates={globalDates} setGlobalDates={setGlobalDates} roomTypes={roomTypes} allAvailability={allAvailability} roomsLoading={roomsLoading} physicalRooms={physicalRooms} cart={cart} updateCartItemQuantity={updateCartItemQuantity} togglePhysicalRoom={togglePhysicalRoom} removeCartItem={removeCartItem} calculateItemTotal={calculateItemTotal} cartSubtotal={finalSubtotal} setStep={setStep} />}
                {step === 2 && <Step2_Occupancy isCheckIn={isCheckIn} updateRoomOccupancy={updateRoomOccupancy} setStep={setStep} guestPool={guestPool} setShowQuickCreate={setShowQuickCreate} searchQuery={searchQuery} setSearchQuery={setSearchQuery} guestLoading={guestLoading} guestResults={guestResults} handleSelectGuest={handleSelectGuest} assignGuestToRoom={assignGuestToRoom} removeGuestFromPool={removeGuestFromPool} markGuestAsPrimary={markGuestAsPrimary} countriesOptions={countriesOptions} getCitiesOptions={getCitiesOptions} setGuestPool={setGuestPool} setGuestTravelData={setGuestTravelData} cart={cart} getRoomCapacity={getRoomCapacity} getCountableOccupants={getCountableOccupants} physicalRooms={physicalRooms} setRoomForCartItem={setRoomForCartItem} />}
                {step === 3 && <Step3_Confirmation setStep={setStep} guestPool={guestPool} cart={cart} isCheckIn={isCheckIn} globalDiscountType={globalDiscountType} setGlobalDiscountType={setGlobalDiscountType} setGlobalDiscountValue={setGlobalDiscountValue} globalDiscountValue={globalDiscountValue} finalSubtotal={finalSubtotal} finalGrandTotal={finalGrandTotal} loyaltyDiscount={loyaltyDiscount} source={source} setSource={setSource} notes={notes} setNotes={setNotes} submitting={submitting} handleCreate={handleCreate} />}
              </>
            )}
          </div>
        </div>
      </div>

      {showQuickCreate && <QuickCreateModal submitting={submitting} quickGuest={quickGuest} setQuickGuest={setQuickGuest} handleQuickCreate={handleQuickCreate} onClose={() => setShowQuickCreate(false)} />}
    </div>,
    document.getElementById('modal-root')
  )
}
