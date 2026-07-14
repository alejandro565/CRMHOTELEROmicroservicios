import React from 'react';
import { Input } from '../../ui';
import { CHARGE_CATEGORIES } from '../hooks/useFolioManager';

export default function FolioChargeForm({
  chargeCategory, setChargeCategory, chargeDesc, setChargeDesc, chargeAmount, setChargeAmount,
  onCancel, layout = 'full'
}) {
  const isCompact = layout === 'compact';

  return (
    <div className={`space-y-${isCompact ? '6' : '6'} animate-fade-in`}>
      <div className={isCompact ? 'flex items-center justify-between' : ''}>
        <h3 className={isCompact ? 'font-black text-slate-900 uppercase tracking-widest text-xs' : 'text-xl font-black text-surface-900 mb-1'}>
          Registrar Gasto
        </h3>
        {isCompact && (
          <button onClick={onCancel} className="text-[10px] text-slate-400 font-bold uppercase">Cancelar</button>
        )}
        {!isCompact && <p className="text-sm text-surface-400">Registrar un nuevo cargo al huésped (consumos, daños, etc.)</p>}
      </div>

      <div className={isCompact ? 'space-y-4' : 'space-y-5'}>
        <div className={isCompact ? '' : 'bg-surface-50 p-5 rounded-2xl border border-surface-200'}>
          <label className={`text-xs font-bold ${isCompact ? 'text-slate-500' : 'text-surface-500'} mb-2 block uppercase tracking-wider`}>Categoría</label>
          <select 
            className={`w-full bg-white border ${isCompact ? 'border-slate-200 h-10' : 'border-surface-200 py-2.5'} rounded-xl px-3 text-sm font-bold text-surface-900 focus:ring-2 focus:ring-brand-500 outline-none`}
            value={chargeCategory} 
            onChange={(e) => setChargeCategory(e.target.value)}
          >
            {CHARGE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>

        <div className={isCompact ? 'space-y-4' : 'bg-surface-50 p-5 rounded-2xl border border-surface-200 space-y-4'}>
          <Input 
            label="Descripción" 
            value={chargeDesc} 
            onChange={e => setChargeDesc(e.target.value)} 
            placeholder={isCompact ? '' : 'Ej: Consumo de Frigobar'} 
          />
          <Input 
            label="Monto (Bs)" 
            type="number" 
            step="0.01" 
            value={chargeAmount} 
            onChange={(e) => setChargeAmount(e.target.value)} 
            placeholder="0.00"
            className={isCompact ? '' : 'font-mono'}
          />
        </div>
      </div>
    </div>
  );
}
