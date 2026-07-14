import React from 'react';
import { ArrowLeft, Users, UserPlus, Search, User, Trash2, Tag, Sparkles, X, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Button, Spinner } from '../../ui';
import { SearchableSelect } from '../../guests/GuestFormFields';
import { calculateAge } from './constants';

export default function Step2_Occupancy({
  setStep,
  guestPool,
  setShowQuickCreate,
  searchQuery,
  setSearchQuery,
  guestLoading,
  guestResults,
  handleSelectGuest,
  assignGuestToRoom,
  removeGuestFromPool,
  markGuestAsPrimary,
  countriesOptions,
  getCitiesOptions,
  setGuestPool,
  setGuestTravelData,
  cart,
  getRoomCapacity,
  getCountableOccupants,
  hideHeader = false,
  hideConfirm = false,
  title = "Asignación de Huéspedes",
  onToggleVerify = null,
  isCheckIn = true,
  updateRoomOccupancy = null,
  physicalRooms = [],
  setRoomForCartItem = null
}) {
  return (
    <div className="flex-1 flex flex-col p-4 lg:p-6 overflow-hidden bg-surface-50 animate-fade-in h-full">
      {!hideHeader && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 shrink-0 gap-4">
          <div className="flex items-center gap-3">
            {setStep && (
              <button onClick={() => setStep(1)}
                className="p-2 rounded-xl hover:bg-white hover:shadow-sm text-surface-400 hover:text-surface-700 transition-all border border-transparent hover:border-surface-200">
                <ArrowLeft size={18}/>
              </button>
            )}
            <div>
              <h3 className="font-black text-xl text-slate-900 tracking-tight leading-none">{title}</h3>
              <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                <Users size={12}/> {guestPool.length} huéspedes en total · Arrastra los nombres a las habitaciones
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="px-4 py-2 bg-white rounded-2xl border border-surface-200 shadow-sm flex items-center gap-3">
              <div className="flex -space-x-2">
                {guestPool.slice(0, 3).map(p => (
                  <div key={p.guest.id} className="w-7 h-7 rounded-full border-2 border-white bg-brand-100 flex items-center justify-center text-[10px] font-bold text-brand-600">
                    {p.guest.first_name[0]}
                  </div>
                ))}
                {guestPool.length > 3 && (
                  <div className="w-7 h-7 rounded-full border-2 border-white bg-surface-100 flex items-center justify-center text-[10px] font-bold text-surface-500">
                    +{guestPool.length - 3}
                  </div>
                )}
              </div>
              <span className="text-xs font-bold text-slate-600">{guestPool.filter(p => !p.res_room_id).length} sin asignar</span>
            </div>

            {!hideConfirm && (
              <Button 
                onClick={() => {
                  if (guestPool.length === 0) return toast.error('Debe añadir al menos un huésped.');
                  if (!guestPool.some(p => p.is_primary)) return toast.error('Selecciona quién será el titular.');
                  setStep(3);
                }}
                variant="primary" className="h-11 px-8 rounded-2xl shadow-lg shadow-brand-500/25 font-bold">
                Confirmar Distribución <ChevronRight size={18} className="ml-1"/>
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden">
        {/* Left: Pool Area */}
        <div className="w-full lg:w-80 h-[30vh] lg:h-full flex flex-col gap-4 bg-white rounded-[32px] border border-surface-200 shadow-sm overflow-hidden shrink-0">
          <div className="p-5 border-b border-surface-50 shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-sm text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Users size={16} className="text-brand-500" /> Huéspedes
              </h4>
              <button 
                onClick={() => setShowQuickCreate(true)} 
                className="group flex items-center gap-2 px-3 py-1.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-all shadow-lg shadow-brand-600/20 active:scale-95"
              >
                <UserPlus size={14} className="group-hover:rotate-12 transition-transform" />
                <span className="text-[10px] font-black uppercase tracking-wider">Nuevo</span>
              </button>
            </div>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" size={14}/>
              <input 
                className="w-full pl-9 pr-4 py-2.5 bg-surface-50 border border-surface-200 rounded-xl focus:ring-2 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all text-xs"
                placeholder="Buscar o añadir..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}/>
                
              {searchQuery.length > 2 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-surface-200 rounded-xl shadow-xl z-[50] max-h-60 overflow-y-auto custom-scrollbar animate-fade-in">
                  {guestLoading ? (
                    <div className="p-4 text-center text-xs text-surface-400"><Spinner size={14}/></div>
                  ) : guestResults.length > 0 ? guestResults.map(g => (
                    <button key={g.id} onClick={() => handleSelectGuest(g)}
                      className="w-full p-3 text-left hover:bg-brand-50 border-b border-surface-50 last:border-0 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-surface-100 flex items-center justify-center shrink-0">
                        <User size={14} className="text-surface-400"/>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 leading-none">{g.first_name} {g.last_name}</p>
                        <p className="text-[10px] text-surface-400 mt-1">{g.doc_number}</p>
                      </div>
                    </button>
                  )) : (
                    <div className="p-6 text-center">
                      <p className="text-xs text-surface-400 mb-3 italic">No se encontraron resultados</p>
                      <button 
                        onClick={() => setShowQuickCreate(true)} 
                        className="w-full py-2 bg-brand-50 text-brand-600 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-brand-100 transition-colors border border-brand-200/50"
                      >
                        + Registrar Nuevo Huésped
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar"
               onDragOver={e => e.preventDefault()}
               onDrop={e => {
                 e.preventDefault();
                 const guestId = e.dataTransfer.getData('guestId');
                 assignGuestToRoom(guestId, null);
               }}>
            <div className="text-[10px] font-black text-surface-400 uppercase tracking-widest px-1 mb-2">Pool (Sin asignar)</div>
            {guestPool.filter(p => !p.res_room_id).length === 0 ? (
              <div className="h-32 flex flex-col items-center justify-center text-surface-300 border-2 border-dashed border-surface-100 rounded-2xl text-center p-4">
                <Users size={24} className="mb-2 opacity-20"/>
                <p className="text-[10px]">Todos los huéspedes están asignados</p>
              </div>
            ) : guestPool.filter(p => !p.res_room_id).map(p => (
              <div key={p.guest.id} 
                   draggable 
                   onDragStart={e => {
                     e.dataTransfer.setData('guestId', p.guest.id);
                     e.dataTransfer.effectAllowed = 'move';
                   }}
                   className={`group relative p-4 bg-white border border-surface-200 rounded-2xl shadow-sm hover:border-brand-500 hover:shadow-md cursor-grab active:cursor-grabbing transition-all ${p.is_primary ? 'ring-2 ring-brand-500 ring-offset-2' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${p.is_primary ? 'bg-brand-500 text-white' : 'bg-surface-50 text-surface-400'}`}>
                    {p.is_primary ? <Tag size={14}/> : <User size={14}/>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-slate-900 truncate uppercase leading-none">
                      {p.guest.first_name} {p.guest.last_name}
                      {p.id_verified && <CheckCircle2 size={10} className="ml-1.5 text-emerald-500 inline-block" />}
                    </p>
                    <p className="text-[10px] text-surface-400 mt-1 truncate">{p.guest.doc_number}</p>
                  </div>
                  <button onClick={() => removeGuestFromPool(p.guest.id)} className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-all">
                    <Trash2 size={14}/>
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                   <button onClick={() => markGuestAsPrimary(p.guest.id)} 
                           className={`text-[9px] font-bold py-1 rounded-lg border transition-all ${p.is_primary ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-white border-surface-200 text-surface-400 hover:bg-brand-50'}`}>
                     {p.is_primary ? 'TITULAR' : 'HACER TITULAR'}
                   </button>
                   <div className="text-[9px] font-bold text-surface-400 flex items-center justify-center gap-1">
                      <Sparkles size={10}/> {calculateAge(p.guest.birth_date) < 5 ? 'INFANTE (No paga)' : p.origin_city || 'Sin origen'}
                   </div>
                </div>

                <div className="mt-3 pt-3 border-t border-dashed border-surface-100 flex gap-1.5" onMouseDown={e => e.stopPropagation()}>
                   <SearchableSelect 
                      placeholder="País"
                      className="flex-1"
                      options={countriesOptions}
                      value={p.origin_country_code || countriesOptions.find(c => c.label === p.origin_country)?.value || ''}
                      onSelect={(val, label) => {
                        setGuestPool(prev => prev.map(item => item.guest.id === p.guest.id ? { ...item, origin_country_code: val, origin_country: label, origin_city: '' } : item))
                      }}
                   />
                   <SearchableSelect 
                      placeholder="Ciudad"
                      className="flex-1"
                      disabled={!p.origin_country_code && !countriesOptions.find(c => c.label === p.origin_country)?.value}
                      options={getCitiesOptions(p.origin_country_code || countriesOptions.find(c => c.label === p.origin_country)?.value)}
                      value={p.origin_city || ''}
                      onSelect={(val, label) => setGuestTravelData(p.guest.id, 'origin_city', val)}
                   />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Room Grid Area */}
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          <div className={`grid gap-6 pb-12 ${cart.length === 1 ? 'grid-cols-1 max-w-2xl mx-auto' : 'grid-cols-1 xl:grid-cols-2'}`}>
            {cart.map(room => {
              const occupants = guestPool.filter(p => p.res_room_id === room.id);
              return (
                <div key={room.id} 
                     onDragOver={e => e.preventDefault()}
                     onDrop={e => {
                       e.preventDefault();
                       const guestId = e.dataTransfer.getData('guestId');
                       assignGuestToRoom(guestId, room.id);
                     }}
                     className={`bg-white border-2 rounded-[32px] p-5 transition-all flex flex-col gap-4 min-h-[180px] ${occupants.length > 0 ? 'border-brand-500/20 shadow-lg' : 'border-dashed border-surface-200 opacity-80'}`}>
                  
                  <div className="flex items-start justify-between shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-10 h-10 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-sm shadow-lg shadow-slate-900/20">
                          {room.room_number || '?'}
                        </div>
                      </div>
                      <div>
                        <h5 className="font-bold text-sm text-slate-900 leading-none">{room.room_type_name}</h5>
                        <div className="flex items-center gap-1.5 mt-1.5 px-2 py-1 bg-surface-50 rounded-lg border border-surface-100 w-fit">
                          <Users size={12} className="text-slate-400" />
                          <p className="text-[10px] text-slate-900 uppercase font-black tracking-tight">Capacidad: {getRoomCapacity(room)} PAX</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      {/* Reservation Mode: Manual Counters */}
                      {!isCheckIn && updateRoomOccupancy && (
                        <div className="mt-3 flex items-center gap-4 border-t border-surface-100 pt-3">
                           <div className="flex flex-col items-center">
                              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Adultos</span>
                              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-0.5">
                                 <button onClick={() => updateRoomOccupancy(room.id, 'adults', -1)} className="w-5 h-5 flex items-center justify-center hover:bg-slate-100 rounded text-slate-600 text-xs font-black">−</button>
                                 <span className="text-[10px] font-black w-3 text-center text-slate-900">{room.adults || 0}</span>
                                 <button onClick={() => updateRoomOccupancy(room.id, 'adults', 1)} className="w-5 h-5 flex items-center justify-center hover:bg-slate-100 rounded text-slate-600 text-xs font-black">+</button>
                              </div>
                           </div>
                           <div className="flex flex-col items-center">
                              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Niños</span>
                              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-0.5">
                                 <button onClick={() => updateRoomOccupancy(room.id, 'children', -1)} className="w-5 h-5 flex items-center justify-center hover:bg-slate-100 rounded text-slate-600 text-xs font-black">−</button>
                                 <span className="text-[10px] font-black w-3 text-center text-slate-900">{room.children || 0}</span>
                                 <button onClick={() => updateRoomOccupancy(room.id, 'children', 1)} className="w-5 h-5 flex items-center justify-center hover:bg-slate-100 rounded text-slate-600 text-xs font-black">+</button>
                              </div>
                           </div>
                           <div className="flex flex-col items-center">
                              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Bebés</span>
                              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-0.5">
                                 <button onClick={() => updateRoomOccupancy(room.id, 'infants', -1)} className="w-5 h-5 flex items-center justify-center hover:bg-slate-100 rounded text-slate-600 text-xs font-black">−</button>
                                 <span className="text-[10px] font-black w-3 text-center text-slate-900">{room.infants || 0}</span>
                                 <button onClick={() => updateRoomOccupancy(room.id, 'infants', 1)} className="w-5 h-5 flex items-center justify-center hover:bg-slate-100 rounded text-slate-600 text-xs font-black">+</button>
                              </div>
                           </div>
                        </div>
                      )}

                      {/* Summary of assigned guests */}
                      <div className="mt-2 flex flex-col items-end gap-1">
                        {isCheckIn && (
                           <div className="flex items-center gap-1.5 px-3 py-1 bg-brand-50 rounded-full border border-brand-100">
                              <Users size={12} className="text-brand-600" />
                              <span className="text-[10px] font-black text-brand-700 leading-none">
                                {getCountableOccupants(room.id)} / {getRoomCapacity(room)} PAX
                              </span>
                           </div>
                        )}
                        {occupants.length > getCountableOccupants(room.id) && (
                          <span className="text-[9px] font-bold text-emerald-600">+{occupants.length - getCountableOccupants(room.id)} infante(s) asignado(s)</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 space-y-2">
                    {occupants.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-surface-400 gap-2 py-4">
                        <div className="p-3 bg-surface-50 rounded-full">
                          <Users size={20} className="opacity-30"/>
                        </div>
                        <p className="text-[10px] font-medium italic">Suelte huéspedes aquí</p>
                      </div>
                    ) : occupants.map(o => (
                      <div key={o.guest.id} 
                           draggable
                           onDragStart={e => {
                             e.dataTransfer.setData('guestId', o.guest.id);
                             e.dataTransfer.effectAllowed = 'move';
                           }}
                           className={`flex items-center justify-between p-3 rounded-2xl group transition-all cursor-grab active:cursor-grabbing border ${o.is_primary ? 'bg-brand-50 border-brand-200' : 'bg-surface-50 border-transparent hover:bg-white hover:border-surface-200 hover:shadow-sm'}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${o.is_primary ? 'bg-brand-500 text-white' : 'bg-white text-surface-400'}`}>
                            {o.is_primary ? <Tag size={10}/> : <User size={10}/>}
                          </div>
                          <p className="text-[11px] font-bold text-slate-900 truncate">
                            {o.guest.first_name} {o.guest.last_name}
                            {o.is_primary && <span className="ml-2 text-[8px] bg-brand-500 text-white px-1.5 py-0.5 rounded uppercase tracking-tighter">TITULAR</span>}
                            {calculateAge(o.guest.birth_date) < 5 && <span className="ml-2 text-[8px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded uppercase tracking-tighter">BEBÉ</span>}
                            {o.id_verified && <CheckCircle2 size={12} className="ml-2 text-emerald-500 inline-block" />}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {onToggleVerify && (
                            <button onClick={() => onToggleVerify(o.guest.id, !o.id_verified)}
                              className={`p-1 rounded-md transition-all ${o.id_verified ? 'text-emerald-500' : 'text-slate-300 hover:text-emerald-500'}`}>
                              <CheckCircle2 size={14}/>
                            </button>
                          )}
                          <button onClick={() => assignGuestToRoom(o.guest.id, null)} 
                                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white rounded-md text-surface-400 hover:text-red-500 transition-all">
                            <X size={12}/>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-auto pt-3 border-t border-surface-50">
                      <div className="text-[9px] font-black text-surface-400 uppercase mb-2 tracking-widest">Procedencia Individual</div>
                      <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar pr-1" onMouseDown={e => e.stopPropagation()}>
                         {occupants.map(o => (
                           <div key={o.guest.id} className="flex items-center gap-2">
                             <span className="text-[10px] font-bold text-slate-500 w-1/4 truncate">{o.guest.first_name}</span>
                             <SearchableSelect 
                                placeholder="País"
                                className="flex-1"
                                options={countriesOptions}
                                value={o.origin_country_code || countriesOptions.find(c => c.label === o.origin_country)?.value || ''}
                                onSelect={(val, label) => {
                                  setGuestPool(prev => prev.map(item => item.guest.id === o.guest.id ? { ...item, origin_country_code: val, origin_country: label, origin_city: '' } : item))
                                }}
                             />
                             <SearchableSelect 
                                placeholder="Ciudad"
                                className="flex-1"
                                disabled={!o.origin_country_code && !countriesOptions.find(c => c.label === o.origin_country)?.value}
                                options={getCitiesOptions(o.origin_country_code || countriesOptions.find(c => c.label === o.origin_country)?.value)}
                                value={o.origin_city || ''}
                                onSelect={(val, label) => setGuestTravelData(o.guest.id, 'origin_city', val)}
                             />
                           </div>
                         ))}
                      </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
