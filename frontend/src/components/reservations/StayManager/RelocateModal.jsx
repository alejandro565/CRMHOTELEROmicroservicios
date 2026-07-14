import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { X, Calendar, Bed, ArrowRight, CheckCircle, Info, Sparkles, Users, ChevronRight } from 'lucide-react';
import { Modal, Button, Input, Spinner, Badge } from '../../ui';
import api from '../../../services/api.client';
import ENDPOINTS from '../../../config/api.config';
import toast from 'react-hot-toast';

export default function RelocateModal({ isOpen, onClose, resRoom, reservation, onRelocate, isRelocating, roomTypes = [] }) {
  const [availability, setAvailability] = useState({});
  const [physicalRooms, setPhysicalRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  
  // Selection state
  const [dates, setDates] = useState({
    check_in_date: '',
    check_out_date: ''
  });
  const [selectedType, setSelectedType] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);

  // Sync dates and auto-select type when resRoom/roomTypes change
  useEffect(() => {
    if (resRoom && isOpen) {
      setDates({
        check_in_date: resRoom.check_in_date,
        check_out_date: resRoom.check_out_date
      });
      
      if (roomTypes.length > 0) {
        const currentType = roomTypes.find(t => t.id === resRoom.room_type_id);
        if (currentType) setSelectedType(currentType);
      }
    }
  }, [resRoom, roomTypes, isOpen]);

  // Fetch Availability when dates/type change
  useEffect(() => {
    if (isOpen && dates.check_in_date && dates.check_out_date) {
      const qs = `check_in_date=${dates.check_in_date}&check_out_date=${dates.check_out_date}`;
      api.get(ENDPOINTS.reservation.checkAvailabilityAll(qs))
        .then(res => setAvailability(res.data.availability || res.data || {}));
        
      if (selectedType) {
        setLoadingRooms(true);
        const roomsQs = `room_type_id=${selectedType.id}&check_in_date=${dates.check_in_date}&check_out_date=${dates.check_out_date}&exclude_res_room_id=${resRoom.id}`;
        api.get(ENDPOINTS.reservation.physicalRooms(roomsQs))
          .then(res => setPhysicalRooms(res.data.data || res.data || []))
          .finally(() => setLoadingRooms(false));
      }
    }
  }, [isOpen, dates, selectedType]);

  const handleConfirm = () => {
    if (!selectedType) { toast.error('Seleccione un tipo de habitación'); return; }
    
    onRelocate({
      resRoomId: resRoom.id,
      room_type_id: selectedType.id,
      room_type_name: selectedType.name,
      room_id: selectedRoom?.id || null,
      room_number: selectedRoom?.number || null,
      rate_per_night: selectedType.base_price,
      check_in_date: dates.check_in_date,
      check_out_date: dates.check_out_date
    });
    onClose();
  };

  const nights = dates.check_in_date && dates.check_out_date ? 
    Math.max(1, Math.round((new Date(dates.check_out_date + 'T12:00') - new Date(dates.check_in_date + 'T12:00')) / (1000 * 60 * 60 * 24))) : 1;

  if (!isOpen) return null;

  return (
    <Modal open={isOpen} onClose={onClose} title="Reubicar / Modificar Estancia" size="xl">
      <div className="flex flex-col h-[75vh]">
        
        {/* Header Summary */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between shrink-0 rounded-t-2xl">
           <div className="flex items-center gap-4">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Origen</p>
                <p className="text-sm font-bold text-white leading-none">{resRoom?.room_type_name} (Hab. {resRoom?.room_number || 'S/N'})</p>
              </div>
              <ArrowRight className="text-slate-600" size={20} />
              <div>
                <p className="text-[10px] font-black text-brand-400 uppercase tracking-widest leading-none mb-1">Destino</p>
                <p className="text-sm font-bold text-white leading-none">{selectedType?.name || '...'}</p>
              </div>
           </div>
           <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Check-in / Check-out</p>
              <p className="text-sm font-bold text-white leading-none">{dates.check_in_date} al {dates.check_out_date}</p>
           </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Side: Parameters */}
          <div className="w-[55%] flex flex-col p-6 border-r border-slate-100 overflow-y-auto custom-scrollbar gap-6 bg-slate-50/30">
            
            {/* Dates */}
            <div>
              <h3 className="font-bold text-xs text-slate-500 mb-3 flex items-center gap-2 uppercase tracking-widest">
                <Calendar size={14} className="text-brand-500" /> Fechas de la Estancia
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Input type="date" label="Check-in"
                  value={dates.check_in_date}
                  onChange={e => setDates(p => ({ ...p, check_in_date: e.target.value }))} className="bg-white"/>
                <Input type="date" label="Check-out"
                  min={dates.check_in_date}
                  value={dates.check_out_date}
                  onChange={e => setDates(p => ({ ...p, check_out_date: e.target.value }))} className="bg-white"/>
              </div>
            </div>

            {/* Room Types */}
            <div>
              <h3 className="font-bold text-xs text-slate-500 mb-3 flex items-center gap-2 uppercase tracking-widest">
                <Bed size={14} className="text-brand-500" /> Selección de Tipo
              </h3>
              <div className="space-y-3">
                {roomTypes.map(rt => {
                  const isSelected = selectedType?.id === rt.id;
                  const isCurrentType = resRoom?.room_type_id === rt.id;
                  const totalCount = parseInt(rt.total_count || 0);
                  const baseAvail = availability[rt.id] !== undefined ? availability[rt.id] : totalCount;
                  
                  // If the guest is already in this room type, we "free up" their slot for the availability display
                  const avail = isCurrentType ? Math.min(totalCount, baseAvail + 1) : baseAvail;
                  
                  return (
                    <div key={rt.id} 
                      onClick={() => { setSelectedType(rt); setSelectedRoom(null); }}
                      className={`cursor-pointer bg-white border rounded-2xl p-4 transition-all ${isSelected ? 'border-brand-500 ring-2 ring-brand-500/10 shadow-lg' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 leading-tight">{rt.name}</h4>
                          <div className="flex items-center gap-3 mt-1">
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                              <Users size={12} className="text-slate-400" /> Máx {rt.max_capacity}
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                              <Sparkles size={12} className="text-slate-400" /> Bs {rt.base_price}/pax
                            </div>
                          </div>
                        </div>
                        <Badge color={avail > 0 ? 'emerald' : 'red'} size="xs">{avail} disp.</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Side: Physical Rooms & Summary */}
          <div className="flex-1 flex flex-col bg-white">
            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
              <h3 className="font-bold text-xs text-slate-500 mb-3 flex items-center gap-2 uppercase tracking-widest">
                <CheckCircle size={14} className="text-emerald-500" /> Unidad Física (Habitación)
              </h3>
              
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 min-h-[200px]">
                {loadingRooms ? (
                  <div className="flex flex-col items-center justify-center h-full py-12">
                    <Spinner size={24} className="text-brand-500 mb-2"/>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Buscando libres...</p>
                  </div>
                ) : !selectedType ? (
                   <div className="flex flex-col items-center justify-center h-full py-12 text-center text-slate-400">
                    <Info size={32} className="mb-2 opacity-30" />
                    <p className="text-xs font-medium">Seleccione un tipo de habitación primero</p>
                  </div>
                ) : physicalRooms.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-12 text-center text-slate-400">
                    <X size={32} className="mb-2 opacity-30" />
                    <p className="text-xs font-medium">No hay unidades disponibles para este tipo en estas fechas.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {physicalRooms.map(room => {
                      const isSelected = selectedRoom?.id === room.id;
                      return (
                        <button
                          key={room.id}
                          type="button"
                          onClick={() => setSelectedRoom(isSelected ? null : room)}
                          className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center justify-center ${isSelected ? 'bg-slate-900 border-slate-900 text-white shadow-xl scale-105' : 'bg-white border-slate-100 hover:border-brand-300 text-slate-600'}`}
                        >
                          <span className="text-[10px] font-black leading-none mb-1">HAB.</span>
                          <span className="text-base font-black leading-none">{room.number}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Price Summary Card */}
              {selectedType && (
                <div className="mt-6 bg-brand-50 border border-brand-100 rounded-2xl p-5 animate-fade-in">
                  <div className="flex justify-between items-end mb-4">
                    <div>
                       <p className="text-[10px] font-black text-brand-700 uppercase tracking-widest mb-1">Nueva Tarifa Base</p>
                       <p className="text-xl font-black text-brand-900 leading-none">Bs {(selectedType.base_price * nights * (resRoom?.adults + resRoom?.children || 1)).toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] font-bold text-slate-500 leading-none">Noches: {nights}</p>
                       <p className="text-[10px] font-bold text-slate-500 leading-none mt-1">Pax: {resRoom?.adults + resRoom?.children}</p>
                    </div>
                  </div>
                  <p className="text-[9px] text-brand-600 italic leading-tight">
                    * El sistema ajustará automáticamente el saldo en el folio. Si la nueva tarifa es mayor, se cargará la diferencia; si es menor, se generará un ajuste a favor.
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-6 border-t border-slate-100 bg-slate-50/50">
              <div className="flex gap-3">
                <Button variant="ghost" fullWidth onClick={onClose} className="font-bold h-12">Cancelar</Button>
                <Button 
                  variant="primary" 
                  fullWidth 
                  onClick={handleConfirm} 
                  loading={isRelocating}
                  className="font-bold h-12 shadow-lg shadow-brand-500/20 text-base"
                >
                  Confirmar Modificación <ChevronRight size={18} className="ml-1"/>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
