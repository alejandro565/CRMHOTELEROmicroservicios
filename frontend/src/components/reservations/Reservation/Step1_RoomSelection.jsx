import React from 'react';
import { Calendar, Bed, ShoppingCart, Trash2, ChevronRight, Users, Info, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { Input, Button, Spinner } from '../../ui';
import toast from 'react-hot-toast';

export default function Step1_RoomSelection({
  isCheckIn,
  globalDates,
  setGlobalDates,
  roomTypes,
  allAvailability,
  roomsLoading,
  physicalRooms,
  cart,
  updateCartItemQuantity,
  togglePhysicalRoom,
  removeCartItem,
  calculateItemTotal,
  cartSubtotal,
  setStep
}) {
  return (
    <div className="flex-1 flex overflow-hidden animate-fade-in">
      {/* Left: Add room form */}
      <div className="w-[52%] flex flex-col p-5 border-r border-surface-100 overflow-y-auto custom-scrollbar gap-5">
        
        {/* Dates */}
        <div>
          <h3 className="font-bold text-sm text-surface-900 mb-2 flex items-center gap-2">
            <Calendar size={14} className="text-brand-500" /> Fechas de la Estancia
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Input type="date" label="Check-in"
              min={format(new Date(), 'yyyy-MM-dd')}
              disabled={isCheckIn}
              value={globalDates.check_in_date}
              onChange={e => setGlobalDates(p => ({ ...p, check_in_date: e.target.value }))} />
            <Input type="date" label="Check-out"
              min={format(new Date(globalDates.check_in_date + 'T12:00'), 'yyyy-MM-dd')}
              value={globalDates.check_out_date}
              onChange={e => setGlobalDates(p => ({ ...p, check_out_date: e.target.value }))} />
          </div>
        </div>

        {/* Categories */}
        <div className="flex-1 min-h-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-surface-900 flex items-center gap-2">
              <Bed size={14} className="text-brand-500" /> Selección de Habitaciones
            </h3>
            {roomsLoading && <div className="text-xs text-brand-600 font-bold flex items-center gap-1"><Spinner size={14}/></div>}
          </div>
          <div className="space-y-3">
            {roomTypes.map(rt => {
              const rtPhysicalRooms = physicalRooms.filter(r => r.room_type_id === rt.id);
              const rtCleanRooms = rtPhysicalRooms.filter(r => r.status === 'CLEAN');
              const totalRooms = rtPhysicalRooms.length;
              
              let avail = isCheckIn 
                ? rtCleanRooms.length 
                : (allAvailability[rt.id] !== undefined ? Math.min(allAvailability[rt.id], totalRooms) : totalRooms);

              const qtyInCart = cart.filter(i => i.room_type_id === rt.id).length;
              const nights = globalDates.check_in_date && globalDates.check_out_date ? 
                Math.max(1, Math.round((new Date(globalDates.check_out_date + 'T12:00') - new Date(globalDates.check_in_date + 'T12:00')) / (1000 * 60 * 60 * 24))) : 1;

              return (
                <div key={rt.id} className={`bg-white border rounded-2xl p-4 flex flex-col gap-3 transition-all ${qtyInCart > 0 ? 'border-brand-500 ring-1 ring-brand-500 shadow-md' : 'border-surface-200 hover:border-surface-300'}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-black text-base text-surface-900 truncate leading-tight">{rt.name}</h4>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            // Logic to show details (could be a simple toast or a small expanded view)
                            toast(
                              <div className="text-left">
                                <p className="font-bold text-xs mb-1">Detalles de {rt.name}:</p>
                                <p className="text-[10px] text-surface-600 mb-2">{rt.description || 'Sin descripción.'}</p>
                                <div className="flex flex-wrap gap-1">
                                  {(rt.amenities || []).map(a => (
                                    <span key={a.id} className="bg-surface-100 px-1.5 py-0.5 rounded text-[9px]">{a.name}</span>
                                  ))}
                                </div>
                              </div>,
                              { duration: 4000, icon: <Info size={16} className="text-brand-500"/> }
                            );
                          }}
                          className="p-1 text-surface-400 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition-all"
                          title="Ver detalles"
                        >
                          <Info size={14} />
                        </button>
                      </div>
                      
                      {/* Bed Configuration */}
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2">
                        {rt.beds && rt.beds.length > 0 ? rt.beds.map(b => (
                          <div key={b.id} className="flex items-center gap-1 text-surface-600">
                            <Bed size={12} className="text-brand-400" />
                            <span className="text-[10px] font-bold">
                              {b.RoomTypeBed?.count || 1} {b.name}
                            </span>
                          </div>
                        )) : (
                          <div className="flex items-center gap-1 text-surface-400 italic">
                            <Bed size={12} />
                            <span className="text-[10px]">Camas no especificadas</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-surface-600">
                          <Users size={12} className="text-brand-400" />
                          <span className="text-[10px] font-bold">Máx {rt.max_capacity}p</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${avail > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        {roomsLoading ? '...' : (avail > 0 ? `${avail} DISP.` : 'AGOTADO')}
                      </span>
                      <div className="text-right">
                        <p className="text-xs font-black text-brand-600 leading-none">Bs {rt.base_price}</p>
                        <p className="text-[9px] text-surface-400 uppercase tracking-tighter">por persona</p>
                      </div>
                    </div>
                  </div>

                  {isCheckIn && rtCleanRooms.length > 0 && (
                    <div className="mt-1 pt-3 border-t border-surface-100">
                      <p className="text-[9px] font-bold text-surface-400 uppercase mb-2">Habitaciones disponibles para Check-in:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {rtCleanRooms.map(room => {
                          const isSelected = cart.some(i => i.room_id === room.id);
                          return (
                            <button
                              key={room.id}
                              onClick={() => togglePhysicalRoom(rt, room)}
                              className={`px-3 py-1.5 text-[10px] font-black rounded-xl border transition-all ${
                                isSelected 
                                  ? 'bg-slate-900 border-slate-900 text-white shadow-md active:scale-95' 
                                  : 'bg-surface-50 border-surface-200 text-surface-600 hover:border-brand-500 hover:bg-brand-50'
                              }`}
                            >
                              HAB. {room.number}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {isCheckIn && rtCleanRooms.length === 0 && (
                     <p className="text-[10px] text-red-500 font-bold bg-red-50 p-2 rounded-lg border border-red-100 flex items-center gap-2">
                       <Sparkles size={12}/> No hay habitaciones limpias disponibles para ingreso inmediato.
                     </p>
                  )}

                  {!isCheckIn && (
                    <div className="flex justify-between items-center mt-1 pt-3 border-t border-surface-100">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black text-slate-900">
                          Bs {(rt.base_price * nights).toFixed(0)}
                        </span>
                        <span className="text-[8px] text-surface-400 uppercase tracking-tighter font-bold">Total base (1p)</span>
                      </div>
                      <div className="flex items-center gap-2.5 bg-surface-50 p-1 rounded-xl border border-surface-200">
                        <button onClick={() => updateCartItemQuantity(rt, -1)}
                          disabled={qtyInCart === 0}
                          className="w-8 h-8 rounded-lg bg-white border border-surface-200 shadow-sm hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-30 flex items-center justify-center font-black text-surface-700 transition-all active:scale-90">
                          −
                        </button>
                        <span className="font-black text-sm w-5 text-center text-slate-900">{qtyInCart}</span>
                        <button onClick={() => updateCartItemQuantity(rt, 1)}
                          disabled={qtyInCart >= avail}
                          className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-900 shadow-md hover:bg-slate-800 disabled:opacity-30 flex items-center justify-center font-black text-white transition-all active:scale-90">
                          +
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right: Cart */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-surface-100 px-4 py-2.5 border-b border-surface-200 flex items-center justify-between shrink-0">
          <h4 className="font-bold text-sm text-surface-900 flex items-center gap-1.5">
            <ShoppingCart size={14}/> Carrito ({cart.length})
          </h4>
          <p className="font-black text-brand-600 text-sm">Bs {cartSubtotal.toFixed(2)}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-surface-50/50 custom-scrollbar">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-surface-400 py-10">
              <Bed size={28} className="mb-2 opacity-30" />
              <p className="text-xs">Añade habitaciones a la izquierda</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="bg-white p-3.5 rounded-2xl border border-surface-200 relative group shadow-sm animate-fade-in space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-surface-900 text-xs truncate leading-none mb-1">{item.room_type_name}</p>
                    <p className="text-[10px] text-surface-400">
                      {item.room_number ? `Hab. ${item.room_number} · ` : ''}
                      {format(new Date(item.check_in_date + 'T12:00'), 'dd/MMM')} →{' '}
                      {format(new Date(item.check_out_date + 'T12:00'), 'dd/MMM')} · {item.nights}n
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-black text-surface-900 text-sm leading-none mb-1">Bs {calculateItemTotal(item).toFixed(2)}</p>
                    <p className="text-[9px] text-surface-400">Bs {item.custom_rate}/pax</p>
                  </div>
                </div>
                <button onClick={() => removeCartItem(item.id)}
                  className="absolute -top-2 -right-2 bg-red-100 text-red-600 p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 size={12}/>
                </button>
              </div>
            ))
          )}
        </div>

        <div className="p-3 bg-white border-t border-surface-200 shrink-0">
          <Button fullWidth variant="primary"
            onClick={() => setStep(2)}
            disabled={cart.length === 0}
            className="h-10 text-sm flex items-center justify-center gap-2">
            Asignación de Huéspedes <ChevronRight size={16}/>
          </Button>
        </div>
      </div>
    </div>
  );
}
