import React from 'react';
import { Home, Sparkles, Users, CheckCircle, Bed, Key, Plus, Package, RefreshCw, AlertTriangle, ArrowRight } from 'lucide-react';
import { Button, Badge } from '../../ui';

const LoanList = ({ room, onReturn, onLost }) => {
  if (!room.loans || room.loans.length === 0) return null;

  return (
    <div className="pt-4 space-y-3 border-t border-slate-100 mt-4">
       <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
         <Package size={12} /> Objetos en Uso
       </h5>
       <div className="grid grid-cols-1 gap-2">
          {room.loans.map(loan => (
            <div key={loan.id} className="flex items-center justify-between p-3 bg-brand-50/50 rounded-2xl border border-brand-100 group transition-all hover:bg-brand-50">
               <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-white rounded-lg shadow-sm">
                    <Package size={14} className="text-brand-600" />
                  </div>
                  <span className="text-xs font-black text-slate-700">{loan.item_name}</span>
               </div>
               <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => onReturn(loan)}
                    className="p-1 hover:bg-emerald-100 text-emerald-600 rounded-md transition-colors"
                    title="Devolver"
                  >
                    <RefreshCw size={12} />
                  </button>
                  <button 
                    onClick={() => onLost(loan)}
                    className="p-1 hover:bg-rose-100 text-rose-600 rounded-md transition-colors"
                    title="Marcar Perdido"
                  >
                    <AlertTriangle size={12} />
                  </button>
               </div>
            </div>
          ))}
       </div>
    </div>
  );
};

export default function StayTab({
  reservation,
  onVerifyGuest,
  isVerifyingGuest,
  verifyingGuestId,
  lendableItems,
  keyItem,
  lendingRoomId,
  setLendingRoomId,
  onLendItem,
  isLendingItem,
  onReturnLoan,
  onMarkLost,
  onCompleteCheckIn,
  isCompletingCheckIn,
  onCheckOut,
  isCheckingOut,
  balance = 0
}) {
  return (
    <div className="space-y-8 animate-fade-in pb-20 px-2">
       
       {/* Context Header Simplified */}
       <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-md ${
              reservation.status === 'IN_HOUSE' ? 'bg-brand-500' : 'bg-emerald-500'
            }`}>
              {reservation.status === 'IN_HOUSE' ? <Home className="text-white w-6 h-6" /> : <Sparkles className="text-white w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 leading-none">
                {reservation.status === 'IN_HOUSE' ? 'Estancia Activa' : 'Confirmación de Llegada'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {reservation.status === 'IN_HOUSE' 
                  ? 'Gestión de llaves y objetos prestados.' 
                  : 'Verifique identidad para formalizar el ingreso.'}
              </p>
            </div>
          </div>
       </div>

       {/* Step 1: Presence (Only if not in house) */}
       {reservation.status !== 'IN_HOUSE' && (
         <div className="space-y-4">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">1</div>
              Verificación de Identidad y Presencia
            </h4>
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 shadow-sm">
              {reservation.guest_list?.map(guest => (
                <div key={guest.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                   <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${guest.id_verified ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                        <Users size={16} />
                      </div>
                      <div>
                         <p className="text-sm font-bold text-slate-800">{guest.guest_name}</p>
                         <p className="text-[10px] text-slate-400 font-mono">
                           {guest.origin_city ? `${guest.origin_city}, ${guest.origin_country}` : 'Procedencia no registrada'}
                           {guest.is_primary && <span className="ml-2 px-1.5 py-0.5 bg-brand-50 text-brand-600 rounded text-[9px] font-bold">TITULAR</span>}
                         </p>
                      </div>
                   </div>
                   <Button 
                     size="sm" 
                     variant={guest.id_verified ? 'ghost' : 'success'}
                     onClick={() => onVerifyGuest({ guestResId: guest.id, id_verified: !guest.id_verified })}
                     loading={isVerifyingGuest && verifyingGuestId === guest.id}
                   >
                     {guest.id_verified ? (
                       <><CheckCircle size={14} className="mr-1"/> Verificado</>
                     ) : 'Confirmar Presencia'}
                   </Button>
                </div>
              ))}
            </div>
         </div>
       )}

       {/* Inventory & Keys Section (Persistent) */}
       <div className="space-y-4">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">
              {reservation.status === 'IN_HOUSE' ? '1' : '2'}
            </div>
            Llaves y Objetos en Uso
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {reservation.rooms?.map(room => (
              <div key={room.id} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
                 <div className="flex items-center justify-between pb-3 border-b border-slate-50">
                    <div className="flex items-center gap-2">
                       <div className="p-2 bg-slate-50 rounded-xl text-slate-600 border border-slate-100">
                         <Bed size={16} />
                       </div>
                       <div>
                         <span className="text-xs font-bold text-slate-900 block leading-tight">{room.room_type_name}</span>
                         <span className="text-[10px] text-slate-400 font-mono">{room.room_number ? `Habitación ${room.room_number}` : 'Unidad no asignada'}</span>
                       </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {balance > 0 ? (
                        <div className="text-right">
                           <p className="text-[9px] font-black text-rose-500 uppercase tracking-tighter leading-none mb-0.5">Saldo Pendiente</p>
                           <p className="text-xs font-black text-slate-900">Bs {parseFloat(balance).toFixed(2)}</p>
                        </div>
                      ) : (
                        <Badge color="green" size="sm">Pagado</Badge>
                      )}
                      {!room.room_id && (
                        <Badge variant="warning" size="sm">REQ. ASIGNACIÓN</Badge>
                      )}
                    </div>
                 </div>

                 {/* Action Buttons */}
                 <div className="grid grid-cols-2 gap-2">
                    <Button 
                       variant="outline" 
                       size="sm"
                       className="rounded-xl border-slate-200"
                       disabled={!room.room_id || !keyItem}
                       onClick={() => onLendItem({
                         res_room_id: room.id,
                         item_id: keyItem.id,
                         item_name: keyItem.name,
                         quantity: 1
                       })}
                       loading={isLendingItem && verifyingGuestId === room.id} // Reusing for room context if needed
                    >
                       <Key size={14} className="mr-2" /> 
                       {keyItem ? keyItem.name : 'Llave'}
                    </Button>
                    
                    <div className="relative">
                       <Button 
                          variant="outline" 
                          size="sm"
                          className={`rounded-xl border-slate-200 w-full transition-all ${lendingRoomId === room.id ? 'bg-slate-100' : ''}`}
                          disabled={!room.room_id}
                          onClick={() => setLendingRoomId(lendingRoomId === room.id ? null : room.id)}
                       >
                          <Plus size={14} className={`mr-2 transition-transform ${lendingRoomId === room.id ? 'rotate-45' : ''}`} /> 
                          {lendingRoomId === room.id ? 'Cerrar' : 'Otros'}
                       </Button>

                       {lendingRoomId === room.id && (
                         <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-2 min-w-[180px] animate-in fade-in slide-in-from-top-1">
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-3 py-2 border-b border-slate-50 mb-1 flex items-center justify-between">
                              <span>Seleccionar Objeto</span>
                              <Package size={10} />
                            </div>
                            <div className="max-h-48 overflow-y-auto custom-scrollbar">
                              {lendableItems?.filter(i => i.id !== keyItem?.id).map(item => (
                                <button
                                  key={item.id}
                                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-brand-50 text-xs font-bold text-slate-700 flex justify-between items-center transition-colors group"
                                  disabled={item.inventory?.available_qty <= 0}
                                  onClick={() => {
                                    onLendItem({
                                      res_room_id: room.id,
                                      item_id: item.id,
                                      item_name: item.name,
                                      quantity: 1
                                    });
                                    setLendingRoomId(null);
                                  }}
                                >
                                  <span className="group-hover:text-brand-600">{item.name}</span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                                    item.inventory?.available_qty > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                                  }`}>
                                    {item.inventory?.available_qty}
                                  </span>
                                </button>
                              ))}
                              {(!lendableItems || lendableItems.length <= 1) && (
                                <p className="text-[10px] text-slate-400 italic text-center py-4">No hay más objetos configurados.</p>
                              )}
                            </div>
                         </div>
                       )}
                    </div>
                 </div>

                 {/* Active Loans List for this room */}
                 <LoanList room={room} onReturn={onReturnLoan} onLost={onMarkLost} />
              </div>
            ))}
          </div>
       </div>

        {/* Final Check-in Button (Only if not IN_HOUSE) */}
        {reservation.status !== 'IN_HOUSE' && (
          <div className="pt-6 border-t border-slate-100">
             <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl -mr-20 -mt-20" />
                <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
                   <div className="text-center md:text-left">
                      <h4 className="text-xl font-black mb-2">Finalizar Check-in</h4>
                      <p className="text-slate-400 text-sm max-w-xs">Formalice el ingreso para habilitar todos los servicios de estancia.</p>
                   </div>
                   <Button 
                     variant="primary" 
                     size="lg" 
                     className="px-10 h-14 rounded-2xl shadow-xl shadow-brand-500/20"
                     disabled={
                       reservation.guest_list?.filter(g => g.id_verified).length === 0 ||
                       reservation.rooms?.some(r => !r.room_id)
                     }
                     loading={isCompletingCheckIn}
                     onClick={onCompleteCheckIn}
                   >
                     Completar Check-in
                   </Button>
                </div>
             </div>
          </div>
        )}

        {/* Unified Check-out Button (Simplified) */}
        {reservation.status === 'IN_HOUSE' && (
          <div className="pt-8 flex justify-center">
             <Button 
               variant={balance === 0 ? "danger" : "outline"}
               size="lg" 
               className={`h-14 px-12 rounded-2xl shadow-xl transition-all ${balance === 0 ? 'animate-pulse shadow-red-500/20' : ''}`}
               disabled={isCheckingOut}
               onClick={onCheckOut}
             >
               <ArrowRight size={18} className="mr-2" /> 
               {balance === 0 ? 'Completar Salida (Check-out)' : `Pendiente de cobro (Bs ${balance.toFixed(2)})`}
             </Button>
          </div>
        )}
    </div>
  );
}
