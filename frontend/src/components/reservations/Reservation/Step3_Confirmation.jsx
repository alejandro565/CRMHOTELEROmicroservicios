import React from 'react';
import { ArrowLeft, Bed, Tag, Users, ShieldCheck, Percent, MessageSquare } from 'lucide-react';
import { Button, Input } from '../../ui';
import { calculateAge } from './constants';

export default function Step3_Confirmation({
  setStep,
  guestPool,
  cart,
  isCheckIn,
  globalDiscountType,
  setGlobalDiscountType,
  setGlobalDiscountValue,
  globalDiscountValue,
  finalSubtotal,
  finalGrandTotal,
  loyaltyDiscount = 0,
  source,
  setSource,
  notes,
  setNotes,
  submitting,
  handleCreate
}) {
  return (
    <div className="flex-1 flex flex-col p-7 pb-12 max-w-2xl mx-auto w-full overflow-y-auto custom-scrollbar animate-fade-up gap-6">
      <div className="flex items-center gap-3">
        <button onClick={() => setStep(2)}
          className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-surface-700 transition-colors">
          <ArrowLeft size={17}/>
        </button>
        <div>
          <h3 className="font-bold text-lg text-surface-900 leading-none">Confirmación de Reserva</h3>
          <p className="text-xs text-surface-500 mt-1">
            Titular: {guestPool.find(p => p.is_primary)?.guest?.first_name} {guestPool.find(p => p.is_primary)?.guest?.last_name} · {cart.length} habitación(es)
          </p>
        </div>
      </div>

      <div className="bg-white border border-surface-200 rounded-2xl p-5 shadow-sm">
        <h4 className="text-sm font-bold text-surface-900 mb-4 flex items-center gap-2">
          <Bed className="text-brand-500" size={16}/>
          Resumen de Habitaciones y Huéspedes
        </h4>
        
        <div className="space-y-3">
          {cart.map(room => {
            const occupants = guestPool.filter(p => p.res_room_id === room.id);
            return (
              <div key={room.id} className="bg-surface-50 p-3 rounded-xl border border-surface-100">
                <div className="flex justify-between items-center mb-2">
                  <h5 className="font-bold text-surface-900 text-sm">{room.room_type_name} {room.room_number && `(${room.room_number})`}</h5>
                  <span className="text-xs font-bold text-surface-500">{occupants.length} pax</span>
                </div>
                
                {occupants.length > 0 ? (
                  <div className="space-y-1.5 pl-2 border-l-2 border-brand-200">
                    {occupants.map(o => (
                      <p key={o.guest.id} className="text-xs text-slate-700 flex items-center justify-between py-1 border-b border-slate-50 last:border-0">
                        <span className="flex items-center gap-2">
                          {o.guest.first_name} {o.guest.last_name} 
                          {o.is_primary && <span className="text-[8px] font-black text-white bg-brand-500 px-1.5 py-0.5 rounded uppercase tracking-tighter shadow-sm">TITULAR</span>}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium italic">{o.origin_country || 'Sin procedencia'}</span>
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-amber-600 italic">No hay huéspedes asignados a esta habitación.</p>
                )}
              </div>
            );
          })}
          
          {/* Unassigned Pool */}
          {guestPool.filter(p => !p.res_room_id).length > 0 && (
            <div className="mt-4 pt-4 border-t border-surface-200">
              <h5 className="font-bold text-surface-600 text-xs mb-2">Huéspedes sin asignar (Pool)</h5>
              <div className="flex flex-wrap gap-2">
                {guestPool.filter(p => !p.res_room_id).map(o => (
                  <span key={o.guest.id} className="text-[10px] bg-white border border-surface-200 rounded-lg px-2.5 py-1.5 text-slate-600 font-bold shadow-sm flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-500"/>
                    {o.guest.first_name} {o.guest.last_name}
                    {o.is_primary && <Tag size={8} className="text-brand-500 fill-current"/>}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {(() => {
        const primary = guestPool.find(p => p.is_primary);
        if (!primary?.guest?.stats?.loyalty_level) return null;
        
        console.log('[Step3_Confirmation] Loyalty data detected:', {
          level: primary.guest.stats.loyalty_level,
          discount: loyaltyDiscount
        });

        return (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex gap-3 items-center animate-fade-in">
            <div className="w-8 h-8 rounded-full bg-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
              <ShieldCheck size={16}/>
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-900">
                Nivel de Lealtad: {primary.guest.stats.loyalty_level.name || 'Activo'}
              </p>
              <p className="text-[10px] text-emerald-700 mt-0.5">
                El sistema aplicará un beneficio del {(loyaltyDiscount * 100).toFixed(0)}% de descuento.
              </p>
            </div>
          </div>
        );
      })()}

      {!isCheckIn && (
        <div className="bg-surface-50 border border-surface-200 rounded-2xl p-5">
          <h4 className="text-sm font-bold text-surface-900 mb-4 flex items-center gap-2">
            <Tag className="text-amber-500" size={14}/>
            Descuento Global Adicional
          </h4>
          <div className="flex gap-3">
            <select
              className="bg-white border border-surface-300 rounded-xl px-3 py-2 text-sm font-bold text-surface-900 outline-none focus:border-brand-500 shadow-sm"
              value={globalDiscountType}
              onChange={e => { setGlobalDiscountType(e.target.value); setGlobalDiscountValue(0) }}>
              <option value="NONE">Sin descuento extra</option>
              <option value="FIXED">Restar monto fijo (Bs)</option>
              <option value="PERCENTAGE">Aplicar porcentaje (%)</option>
            </select>
            {globalDiscountType !== 'NONE' && (
              <div className="flex-1 animate-fade-in">
                <Input type="number" min="0"
                  placeholder={globalDiscountType === 'FIXED' ? 'Ej: 50' : 'Ej: 10'}
                  value={globalDiscountValue}
                  onChange={e => setGlobalDiscountValue(parseFloat(e.target.value) || 0)}/>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grand total card */}
      <div 
        style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
        className="p-8 rounded-[32px] shadow-2xl relative overflow-visible">
        
        <div className="space-y-1.5 mb-8">
          <span className="text-[10px] uppercase font-black text-slate-500 tracking-[0.2em] opacity-80">Liquidación Final</span>
          <div className="flex justify-between items-center text-sm text-slate-300">
            <span>Monto subtotal (por ocupación)</span>
            <span className="font-medium">Bs {finalSubtotal.toFixed(2)}</span>
          </div>
          {loyaltyDiscount > 0 && (
            <div className="flex justify-between items-center text-sm text-emerald-400 font-bold">
              <span className="flex items-center gap-1"><ShieldCheck size={12}/> Descuento por Lealtad ({(loyaltyDiscount * 100).toFixed(0)}%)</span>
              <span>− Bs {(finalSubtotal * loyaltyDiscount).toFixed(2)}</span>
            </div>
          )}
          {globalDiscountType !== 'NONE' && globalDiscountValue > 0 && (
            <div className="flex justify-between items-center text-sm text-amber-400 font-bold">
              <span className="flex items-center gap-1"><Percent size={12}/> Descuento global aplicado</span>
              <span>− Bs {( (finalSubtotal * (1 - loyaltyDiscount)) - finalGrandTotal).toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="pt-8 border-t border-white/10">
          <p className="text-[10px] uppercase font-black text-slate-400 mb-2 opacity-60">Total Neto a Cobrar</p>
          <div className="flex items-baseline gap-2 text-white">
            <span className="text-2xl opacity-40 font-medium">Bs</span>
            <span className="text-6xl font-black tracking-tighter leading-none">
              {(finalGrandTotal || 0).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {!isCheckIn && (
        <div className="bg-slate-50 p-1.5 rounded-2xl border border-slate-200 flex gap-1.5">
          {['PHONE', 'WEB', 'OTA'].map(s => (
            <button key={s} onClick={() => setSource(s)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all
                ${source === s
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'text-slate-500 hover:bg-slate-100'}`}>
              {s === 'PHONE' ? 'Teléfono' : s === 'WEB' ? 'Venta Web' : 'Booking / OTA'}
            </button>
          ))}
        </div>
      )}

      <div>
        <label className="text-sm font-bold text-surface-900 mb-2 block">Notas Operativas</label>
        <textarea
          style={{ color: '#0f172a' }}
          className="w-full px-5 py-4 bg-white border border-surface-200 rounded-2xl h-24 focus:ring-2 focus:ring-brand-500 outline-none text-sm resize-none font-medium shadow-sm transition-all"
          placeholder="Ej: Necesita cuna, llegará después de las 22:00, etc..."
          value={notes} onChange={e => setNotes(e.target.value)}/>
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex gap-3 items-center">
        <div className="w-8 h-8 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
          <Users size={16}/>
        </div>
        <p className="text-xs text-indigo-800 font-medium leading-relaxed">
          Se generará un <strong>portal de registro digital</strong> para que los acompañantes completen sus datos.
        </p>
      </div>

      <div className="flex gap-4 pt-4 mt-2">
        <Button variant="ghost" onClick={() => setStep(2)} 
          style={{ color: '#475569' }}
          className="flex-1 h-12 rounded-2xl font-black bg-slate-100 hover:bg-slate-200 border-none transition-all">
          ← Volver
        </Button>
        <Button fullWidth loading={submitting} onClick={handleCreate}
          style={{ backgroundColor: '#4f46e5', color: '#ffffff' }}
          className="flex-[2.5] h-12 rounded-2xl text-base font-black shadow-xl shadow-indigo-500/25 transition-all hover:scale-[1.01] active:scale-95">
          {isCheckIn ? '✓ Confirmar Check-in' : '✓ Emitir Reserva'}
        </Button>
      </div>
    </div>
  );
}
