import React, { useState } from 'react';
import { format } from 'date-fns';
import { Info, Calendar, Bed, ChevronDown, ChevronUp, MoveHorizontal, Clock } from 'lucide-react';
import { Card, Button, Badge, Spinner, Select, Input } from '../../ui';
import RelocateModal from './RelocateModal';

export default function DetailsTab({ 
  reservation, 
  onFetchPhysicalRooms,
  assigningResRoomId,
  availablePhysicalRooms,
  isLoadingRooms,
  onAssignPhysicalRoom,
  onRelocate,
  onExtend,
  isRelocating,
  isExtending,
  roomTypes
}) {
  const [expandedTypes, setExpandedTypes] = useState({});
  const [isRelocateModalOpen, setIsRelocateModalOpen] = useState(false);
  const [selectedResRoom, setSelectedResRoom] = useState(null);
  const [extendingId, setExtendingId] = useState(null);
  const [extraNights, setExtraNights] = useState(1);

  const toggleExpand = (typeName) => {
    setExpandedTypes(prev => ({ ...prev, [typeName]: !prev[typeName] }));
  };

  // Group rooms by type and assignment status
  const roomsByType = reservation.rooms?.reduce((acc, room) => {
    if (!acc[room.room_type_name]) {
      acc[room.room_type_name] = {
        assigned: [],
        unassigned: [],
        typeId: room.room_type_id,
        checkIn: room.check_in_date,
        checkOut: room.check_out_date,
        rate: room.rate_per_night
      };
    }
    if (room.room_id) {
      acc[room.room_type_name].assigned.push(room);
    } else {
      acc[room.room_type_name].unassigned.push(room);
    }
    return acc;
  }, {});

  // Get general dates (assuming they are mostly the same, or just take from the first room)
  const firstRoom = reservation.rooms?.[0];
  const generalCheckIn = firstRoom ? format(new Date(firstRoom.check_in_date + 'T12:00'), 'EEEE, dd MMMM') : '';
  const generalCheckOut = firstRoom ? format(new Date(firstRoom.check_out_date + 'T12:00'), 'EEEE, dd MMMM') : '';

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* General Stay Info */}
      <div className="bg-brand-50 border border-brand-100 rounded-2xl p-4 flex items-center justify-between">
         <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-600 text-white rounded-xl shadow-md">
               <Calendar size={18} />
            </div>
            <div>
               <p className="text-[10px] font-black text-brand-700 uppercase tracking-widest">Periodo de Estancia</p>
               <p className="text-sm font-bold text-slate-900">
                  {generalCheckIn} — {generalCheckOut}
               </p>
            </div>
         </div>
         <Badge color="indigo" size="lg" className="px-4 py-1">
            {reservation.rooms?.length} Habitación{reservation.rooms?.length !== 1 ? 'es' : ''}
         </Badge>
      </div>

      <div className="space-y-4">
        {Object.entries(roomsByType || {}).map(([typeName, data]) => (
          <div key={typeName} className="space-y-3">
            
            {/* Type Header */}
            <div className="flex items-center justify-between px-2">
               <h4 className="font-black text-slate-800 uppercase tracking-widest text-[11px]">{typeName}</h4>
               <span className="text-[10px] font-bold text-slate-400">Tarifa: Bs {parseFloat(data.rate).toFixed(2)}</span>
            </div>

            {/* Assigned Rooms */}
            {data.assigned.map(room => (
              <Card key={room.id} className="p-4 border-slate-200 overflow-visible relative">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                     <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                        <Bed size={16} />
                     </div>
                     <div>
                        <p className="text-sm font-bold text-slate-900">Habitación {room.room_number}</p>
                        <p className="text-[10px] text-slate-400 font-medium">Asignada correctamente</p>
                     </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="xs" 
                      variant="ghost" 
                      className="text-brand-600 hover:bg-brand-50 font-bold"
                      onClick={() => { setSelectedResRoom(room); setIsRelocateModalOpen(true); }}
                    >
                      <MoveHorizontal size={14} className="mr-1"/> Reubicar
                    </Button>
                    <Button 
                      size="xs" 
                      variant="ghost" 
                      className="text-emerald-600 hover:bg-emerald-50 font-bold"
                      onClick={() => { setExtendingId(extendingId === room.id ? null : room.id); }}
                    >
                      <Clock size={14} className="mr-1"/> Extender
                    </Button>
                  </div>
                </div>


                {extendingId === room.id && (
                  <div className="mt-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100 animate-fade-in">
                    <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-2">Extender tiempo de estadía</p>
                    <div className="flex items-center gap-3">
                       <div className="flex-1 flex items-center gap-2">
                          <span className="text-xs font-bold text-emerald-800">Noches extra:</span>
                          <Input 
                            type="number" min="1" 
                            className="w-20 h-9 text-center font-bold"
                            value={extraNights} 
                            onChange={e => setExtraNights(parseInt(e.target.value) || 1)}
                          />
                       </div>
                       <Button 
                        size="sm" 
                        loading={isExtending}
                        onClick={() => {
                          onExtend({ resRoomId: room.id, extraNights });
                          setExtendingId(null);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                       >
                         Confirmar Extension
                       </Button>
                    </div>
                  </div>
                )}
              </Card>
            ))}

            {/* Unassigned Rooms Summary */}
            {data.unassigned.length > 0 && (
              <Card className="border-amber-200 bg-amber-50/30 overflow-hidden">
                 <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
                          <Info size={16} />
                       </div>
                       <div>
                          <p className="text-sm font-bold text-slate-900">
                             {data.unassigned.length} Habitación{data.unassigned.length !== 1 ? 'es' : ''} por asignar
                          </p>
                          <p className="text-[10px] text-amber-600 font-medium">Requiere asignar unidad física</p>
                       </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="border-amber-200 text-amber-700 hover:bg-amber-100"
                      onClick={() => toggleExpand(typeName)}
                    >
                       {expandedTypes[typeName] ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                       {expandedTypes[typeName] ? 'Cerrar' : 'Asignar'}
                    </Button>
                 </div>

                 {expandedTypes[typeName] && (
                    <div className="px-4 pb-4 space-y-3 animate-fade-in border-t border-amber-100 pt-4">
                       {data.unassigned.map(room => (
                          <div key={room.id} className="bg-white p-3 rounded-xl border border-amber-100">
                             <div className="flex justify-between items-center mb-3">
                                <span className="text-[10px] font-bold text-slate-500">Unidad #{room.id.slice(-4)}</span>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-7 text-[10px] text-brand-600 font-bold"
                                  onClick={() => onFetchPhysicalRooms(room)}
                                >
                                   {assigningResRoomId === room.id ? 'Cancelar' : 'Seleccionar Habitación'}
                                </Button>
                             </div>

                             {assigningResRoomId === room.id && (
                               <div className="bg-brand-50 rounded-lg p-3 border border-brand-100 flex items-center gap-2 overflow-x-auto custom-scrollbar">
                                 {isLoadingRooms ? (
                                   <Spinner size={14} className="text-brand-500 mx-auto"/>
                                 ) : availablePhysicalRooms.length === 0 ? (
                                    <span className="text-xs text-brand-700">No hay unidades libres.</span>
                                 ) : (
                                    availablePhysicalRooms.map(pr => (
                                       <button key={pr.id} 
                                          onClick={() => onAssignPhysicalRoom({ resRoomId: room.id, roomId: pr.id, roomNumber: pr.number })}
                                          className="px-3 py-1.5 bg-white border border-brand-200 text-brand-700 hover:bg-brand-600 hover:text-white transition-colors rounded-md text-xs font-bold whitespace-nowrap">
                                          Hab. {pr.number}
                                       </button>
                                    ))
                                 )}
                               </div>
                             )}
                          </div>
                       ))}
                    </div>
                 )}
              </Card>
            )}
          </div>
        ))}
      </div>
      
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
         <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Notas de la Reserva</h5>
         <p className="text-sm text-slate-600 italic">
           {reservation.notes || 'Sin notas adicionales.'}
         </p>
      </div>
      <RelocateModal 
        isOpen={isRelocateModalOpen}
        onClose={() => setIsRelocateModalOpen(false)}
        resRoom={selectedResRoom}
        reservation={reservation}
        onRelocate={onRelocate}
        isRelocating={isRelocating}
        roomTypes={roomTypes}
      />
    </div>
  );
}
