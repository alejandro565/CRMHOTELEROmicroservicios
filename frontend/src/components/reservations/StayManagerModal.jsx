import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api.client';
import ENDPOINTS from '../../config/api.config';
import { Modal, Spinner, StatusBadge } from '../ui';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { 
  Users, CreditCard, Info, Sparkles, Share2, Copy, MessageSquare
} from 'lucide-react';

import { PAYMENT_METHODS, CHARGE_CATEGORIES, emptyGuest } from './StayManager/constants';
import DetailsTab from './StayManager/DetailsTab';
import GuestsTab from './StayManager/GuestsTab';
import StayTab from './StayManager/StayTab';
import BillingTab from './StayManager/BillingTab';

export default function StayManagerModal({ isOpen, onClose, reservationId, onUpdate }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState('details');
  const [lendingRoomId, setLendingRoomId] = useState(null);
  const [portalData, setPortalData] = useState(null);
  const [showGuestSearch, setShowGuestSearch] = useState(null);
  
  const [regMode, setRegMode] = useState('search');
  const [newGuestData, setNewGuestData] = useState(emptyGuest());
  const [creatingGuest, setCreatingGuest] = useState(false);

  const [assigningResRoomId, setAssigningResRoomId] = useState(null);
  const [availablePhysicalRooms, setAvailablePhysicalRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  const { data: res, isLoading } = useQuery({
    queryKey: ['reservation-detail', reservationId],
    queryFn: () => api.get(ENDPOINTS.reservation.getReservation(reservationId)),
    enabled: !!reservationId && isOpen,
  });

  const reservation = res?.data;

  const { data: folioData, isLoading: loadingFolio } = useQuery({
    queryKey: ['folios', reservationId],
    queryFn: () => api.get(ENDPOINTS.billing.foliosByRes(reservationId)),
    enabled: isOpen && !!reservationId,
  });

  const folios = folioData?.data || [];
  const folio = folios.find(f => f.type === 'MASTER') || folios[0];

  const { data: ratesData } = useQuery({
    queryKey: ['exchange-rates'],
    queryFn: () => api.get(ENDPOINTS.billing.listRates()),
    enabled: isOpen,
  });

  const { data: roomTypesData } = useQuery({
    queryKey: ['room-types'],
    queryFn: () => api.get(ENDPOINTS.hotels.listRoomTypes()),
    enabled: isOpen,
  });
  const roomTypes = roomTypesData?.data || [];

  const balance = folios.reduce((acc, f) => acc + parseFloat(f.balance || 0), 0);

  // Mutations
  const changeResponsible = useMutation({
    mutationFn: (newGuestId) => api.patch(ENDPOINTS.reservation.changeResponsible(reservationId), { new_guest_id: newGuestId }),
    onSuccess: () => { toast.success('Responsable cambiado'); qc.invalidateQueries(['reservation-detail', reservationId]); },
    onError: (err) => toast.error(err.message)
  });

  const addGuest = useMutation({
    mutationFn: ({ resRoomId, guestId }) => api.post(ENDPOINTS.reservation.addGuestToReservation(reservationId), { guest_id: guestId, res_room_id: resRoomId || null }),
    onSuccess: () => { toast.success('Huésped añadido'); setShowGuestSearch(null); setGuestSearch(''); setSearchResults([]); qc.invalidateQueries(['reservation-detail', reservationId]); },
    onError: (err) => toast.error(err.message)
  });

  const removeGuest = useMutation({
    mutationFn: ({ guestResId }) => api.delete(ENDPOINTS.reservation.removeGuest(guestResId)),
    onSuccess: () => { toast.success('Huésped retirado'); qc.invalidateQueries(['reservation-detail', reservationId]); },
    onError: (err) => toast.error(err.message)
  });

  const updateGuestMutation = useMutation({
    mutationFn: ({ guestResId, ...data }) => api.patch(ENDPOINTS.reservation.updateGuestData(guestResId), data),
    onSuccess: () => qc.invalidateQueries(['reservation-detail', reservationId]),
  });

  const assignPhysicalRoom = useMutation({
    mutationFn: ({ resRoomId, roomId, roomNumber }) => api.patch(ENDPOINTS.reservation.assignPhysicalRoom(resRoomId), { room_id: roomId, room_number: roomNumber }),
    onSuccess: () => { toast.success('Habitación física asignada'); qc.invalidateQueries(['reservation-detail', reservationId]); },
    onError: (err) => toast.error(err.message)
  });

  const completeCheckIn = useMutation({
    mutationFn: () => api.post(ENDPOINTS.reservation.checkIn(reservationId)),
    onSuccess: () => { toast.success('¡Check-in completado!'); qc.invalidateQueries(['reservation-detail', reservationId]); if (onUpdate) onUpdate(); },
    onError: (err) => toast.error(err.message)
  });

  const assignGuestToRoom = useMutation({
    mutationFn: ({ guestResId, resRoomId }) => api.patch(ENDPOINTS.reservation.assignGuestToRoom(guestResId), { res_room_id: resRoomId }),
    onSuccess: () => { toast.success('Huésped asignado'); qc.invalidateQueries(['reservation-detail', reservationId]); },
    onError: (err) => toast.error(err.message)
  });

  const lendItem = useMutation({
    mutationFn: (data) => api.post(ENDPOINTS.reservation.lendItem(), data),
    onSuccess: () => { toast.success('Objeto entregado'); qc.invalidateQueries(['reservation-detail', reservationId]); },
    onError: (err) => toast.error(err.message)
  });

  const returnLoan = useMutation({
    mutationFn: (loanId) => api.patch(ENDPOINTS.reservation.returnLoan(loanId)),
    onSuccess: () => { toast.success('Objeto devuelto'); qc.invalidateQueries(['reservation-detail', reservationId]); },
    onError: (err) => toast.error(err.message)
  });

  const markLost = useMutation({
    mutationFn: (loanId) => api.patch(ENDPOINTS.reservation.markLost(loanId)),
    onSuccess: () => { toast.success('Objeto marcado como perdido'); qc.invalidateQueries(['reservation-detail', reservationId]); },
    onError: (err) => toast.error(err.message)
  });

  const generatePortal = useMutation({
    mutationFn: () => api.post(ENDPOINTS.reservation.genPortalToken(reservationId), {}),
    onSuccess: (data) => setPortalData(data.data),
    onError: (err) => toast.error(err.message)
  });
  
  const relocateMutation = useMutation({
    mutationFn: ({ resRoomId, ...payload }) => api.patch(ENDPOINTS.reservation.relocate(resRoomId), payload),
    onSuccess: () => { toast.success('Reubicación completada'); qc.invalidateQueries(['reservation-detail', reservationId]); qc.invalidateQueries(['folios', reservationId]); },
    onError: (err) => toast.error(err.message)
  });

  const extendMutation = useMutation({
    mutationFn: ({ resRoomId, extraNights }) => api.patch(ENDPOINTS.reservation.extendStay(resRoomId), { extra_nights: extraNights }),
    onSuccess: () => { toast.success('Estadía extendida'); qc.invalidateQueries(['reservation-detail', reservationId]); qc.invalidateQueries(['folios', reservationId]); },
    onError: (err) => toast.error(err.message)
  });

  const checkOutMut = useMutation({
    mutationFn: () => api.post(ENDPOINTS.reservation.checkOut(reservationId)),
    onSuccess: () => { toast.success('Check-out completado'); qc.invalidateQueries(['reservations']); onUpdate?.(); onClose(); },
    onError: (err) => toast.error(err.message)
  });

  const { data: lendableItems } = useQuery({
    queryKey: ['lendable-items-catalog'],
    queryFn: () => api.get(ENDPOINTS.hotels.listItems()).then(r => r.data || []),
    enabled: isOpen
  });

  const keyItem = useMemo(() => {
    if (!lendableItems) return null;
    return lendableItems.find(item => item.name.toLowerCase().includes('llave') || item.name.toLowerCase().includes('tarjeta'));
  }, [lendableItems]);



  const handleCheckOut = () => {
    const allLoans = reservation.rooms?.reduce((acc, r) => [...acc, ...(r.loans || [])], []) || [];
    if (allLoans.length > 0) return toast.error(`Hay ${allLoans.length} objetos pendientes.`);
    if (balance !== 0) return toast.error('Debe saldar la cuenta antes del check-out.');
    if (window.confirm('¿Confirmar salida?')) checkOutMut.mutate();
  };

  const handleCreateAndAddGuest = async (resRoomId) => {
    if (!newGuestData.first_name || !newGuestData.last_name || !newGuestData.doc_number) return toast.error('Datos incompletos');
    setCreatingGuest(true);
    try {
      const normalized = Object.keys(newGuestData).reduce((acc, key) => { acc[key] = newGuestData[key] === '' ? null : newGuestData[key]; return acc; }, {});
      const res = await api.post(ENDPOINTS.guest.createGuest(), normalized);
      await addGuest.mutateAsync({ resRoomId, guestId: (res.data || res).id });
      setNewGuestData(emptyGuest());
      setRegMode('search');
    } catch (err) { toast.error(err.message); } finally { setCreatingGuest(false); }
  };

  const handleFetchPhysicalRooms = async (room) => {
    if (assigningResRoomId === room.id) return setAssigningResRoomId(null);
    setAssigningResRoomId(room.id);
    setLoadingRooms(true);
    try {
      const qs = `room_type_id=${room.room_type_id}&check_in_date=${room.check_in_date}&check_out_date=${room.check_out_date}`;
      const res = await api.get(ENDPOINTS.reservation.physicalRooms(qs));
      setAvailablePhysicalRooms(res.data || res || []);
    } catch (e) { toast.error("Error al cargar habitaciones"); setAvailablePhysicalRooms([]); } finally { setLoadingRooms(false); }
  };

  if (isLoading || !reservation) {
    return (
      <Modal open={isOpen} onClose={onClose} title="Cargando...">
        <div className="flex justify-center py-12"><Spinner size={40} className="text-brand-500" /></div>
      </Modal>
    );
  }

  const tabs = [
    { id: 'details', label: 'Detalles', icon: <Info size={16}/> },
    { id: 'guests', label: 'Huéspedes', icon: <Users size={16}/> },
    { id: 'stay', label: reservation.status === 'IN_HOUSE' ? 'Estancia / Objetos' : 'Llegada / Check-in', icon: <Sparkles size={16}/>, hidden: !['CONFIRMED', 'PRE_CHECKIN', 'IN_HOUSE'].includes(reservation.status) },
    { id: 'billing', label: 'Cuentas / Folio', icon: <CreditCard size={16}/> },
  ];

  return (
    <Modal open={isOpen} onClose={onClose} title={`Gestión de Estancia — ${reservation.id.slice(0,8)}`} size="2xl">
      <div className="flex flex-col h-full max-h-[90vh]">
        
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 flex items-center justify-between">
           <div className="flex items-center gap-4">
              <StatusBadge status={reservation.status} />
              <div className="flex flex-col">
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Titular de Reserva</span>
                 <span className="text-sm font-bold text-slate-800">{reservation.main_guest_name}</span>
              </div>
           </div>

           {/* Portal Link (General for the reservation) */}
           <div className="flex items-center gap-3">
              {!portalData ? (
                <button 
                  onClick={() => generatePortal.mutate()} 
                  disabled={generatePortal.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-50 text-brand-600 rounded-xl text-xs font-bold hover:bg-brand-100 transition-all border border-brand-200"
                >
                  <Share2 size={14}/> {generatePortal.isPending ? 'Generando...' : 'Link de Registro'}
                </button>
              ) : (
                <div className="flex items-center gap-2 p-1 bg-white rounded-xl border border-slate-200 shadow-sm animate-fade-in">
                   <button 
                     onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/portal/${portalData.token}`); toast.success('Link copiado'); }}
                     className="px-3 py-1.5 text-[10px] font-bold text-brand-600 hover:bg-brand-50 rounded-lg flex items-center gap-1.5 transition-colors"
                   >
                     <Copy size={12}/> Copiar Link
                   </button>
                   <div className="w-px h-4 bg-slate-200" />
                   <button 
                     onClick={() => toast.success('Notificación enviada')}
                     className="px-3 py-1.5 text-[10px] font-bold text-emerald-600 hover:bg-emerald-50 rounded-lg flex items-center gap-1.5 transition-colors"
                   >
                     <MessageSquare size={12}/> WhatsApp
                   </button>
                </div>
              )}
           </div>
        </div>

        <div className="flex border-b border-slate-100 mb-6">
          {tabs.filter(t => !t.hidden).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-bold transition-all border-b-2 
                ${activeTab === tab.id ? 'border-brand-500 text-brand-600 bg-brand-50/30' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
          {activeTab === 'details' && (
            <DetailsTab 
              reservation={reservation}
              onFetchPhysicalRooms={handleFetchPhysicalRooms}
              assigningResRoomId={assigningResRoomId}
              availablePhysicalRooms={availablePhysicalRooms}
              isLoadingRooms={loadingRooms}
              onAssignPhysicalRoom={assignPhysicalRoom.mutate}
              onRelocate={relocateMutation.mutate}
              onExtend={extendMutation.mutate}
              isRelocating={relocateMutation.isPending}
              isExtending={extendMutation.isPending}
              roomTypes={roomTypes}
            />
          )}

          {activeTab === 'guests' && (
            <GuestsTab 
              reservation={reservation}
              showGuestSearch={showGuestSearch}
              setShowGuestSearch={setShowGuestSearch}
              regMode={regMode}
              setRegMode={setRegMode}
              newGuestData={newGuestData}
              onNewGuestDataChange={(f, v) => setNewGuestData(p => typeof f === 'object' ? { ...p, ...f } : { ...p, [f]: v })}
              creatingGuest={creatingGuest}
              onCreateAndAddGuest={handleCreateAndAddGuest}
              onChangeResponsible={changeResponsible.mutate}
              onUpdateGuest={updateGuestMutation.mutate}
              onAddGuest={addGuest.mutate}
              onAssignGuestToRoom={assignGuestToRoom.mutate}
              onRemoveGuest={removeGuest.mutate}
              isUpdatingGuest={updateGuestMutation.isPending}
              updatingGuestId={updateGuestMutation.variables?.guestResId}
            />
          )}

          {activeTab === 'stay' && (
            <StayTab 
              reservation={reservation}
              onVerifyGuest={updateGuestMutation.mutate}
              isVerifyingGuest={updateGuestMutation.isPending}
              verifyingGuestId={updateGuestMutation.variables?.guestResId}
              lendableItems={lendableItems}
              keyItem={keyItem}
              lendingRoomId={lendingRoomId}
              setLendingRoomId={setLendingRoomId}
              onLendItem={lendItem.mutate}
              isLendingItem={lendItem.isPending}
              onReturnLoan={l => returnLoan.mutate(l.id)}
              onMarkLost={l => markLost.mutate(l.id)}
              onCompleteCheckIn={completeCheckIn.mutate}
              isCompletingCheckIn={completeCheckIn.isPending}
              onCheckOut={handleCheckOut}
              isCheckingOut={checkOutMut.isPending}
              balance={balance}
            />
          )}

          {activeTab === 'billing' && (
            <BillingTab 
              reservation={reservation}
              onCheckOut={handleCheckOut}
              isCheckingOut={checkOutMut.isPending}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}
