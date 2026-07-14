import React from 'react';
import { Input } from '../../ui';
import { DollarSign, FileText } from 'lucide-react';
import { PAYMENT_METHODS } from '../hooks/useFolioManager';

export default function FolioPaymentForm({
  payAmount, setPayAmount, currency, setCurrency, rates, calculateEquivalent, balance,
  payMethod, setPayMethod, requireInvoice, setRequireInvoice, invoiceData, setInvoiceData,
  onCancel, onSubmit, isSubmitting, layout = 'full'
}) {
  const isCompact = layout === 'compact';

  return (
    <div className={`space-y-${isCompact ? '4' : '8'} animate-fade-in`}>
      <div className={isCompact ? 'flex items-center justify-between' : ''}>
        <h3 className={isCompact ? 'font-black text-slate-900 uppercase tracking-widest text-xs' : 'text-xl font-black text-surface-900 flex items-center gap-2 mb-1'}>
          {!isCompact && <DollarSign className="text-brand-500" />} Nuevo Pago
        </h3>
        {isCompact && (
          <button onClick={onCancel} className="text-[10px] text-slate-400 font-bold uppercase">Cerrar</button>
        )}
        {!isCompact && <p className="text-sm text-surface-400">Ingresa los detalles del pago a procesar.</p>}
      </div>

      <div className={`grid ${isCompact ? 'grid-cols-2 gap-4' : 'grid-cols-2 gap-4'}`}>
        <div className="space-y-4">
          <div className={isCompact ? '' : 'bg-surface-50 p-4 rounded-2xl border border-surface-200'}>
            <label className={`text-xs font-bold ${isCompact ? 'text-slate-500' : 'text-surface-500'} mb-2 block uppercase tracking-wider`}>Moneda</label>
            <select 
              className={`w-full bg-white border ${isCompact ? 'border-slate-200 h-10' : 'border-surface-200 py-2.5'} rounded-xl px-3 text-sm font-bold text-surface-900 focus:ring-2 focus:ring-brand-500 outline-none`}
              value={currency} 
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="BOB">Bs (Local)</option>
              {rates.map(r => <option key={r.id} value={r.currency}>{r.currency}</option>)}
            </select>
            {!isCompact && currency !== 'BOB' && rates.find(r => r.currency===currency) && (
              <div className="mt-2 bg-brand-50 border border-brand-100 rounded-lg p-2 flex items-center justify-between">
                <span className="text-[10px] font-bold text-brand-600 uppercase tracking-widest">Tasa del día activa</span>
                <span className="text-xs font-black text-surface-900 border-b border-dashed border-surface-400">
                  1 {currency} = {parseFloat(rates.find(r => r.currency===currency).rate).toFixed(2)} BOB
                </span>
              </div>
            )}
          </div>
          
          <div className={isCompact ? '' : 'bg-surface-50 p-4 rounded-2xl border border-surface-200'}>
            <Input 
              label={isCompact ? 'Monto' : `Monto a Pagar (${currency})`} 
              type="number" 
              step="0.01" 
              value={payAmount} 
              onChange={(e) => setPayAmount(e.target.value)} 
              placeholder="0.00"
              className={isCompact ? '' : 'text-lg font-mono font-bold'}
            />
            {!isCompact && currency !== 'BOB' && payAmount > 0 && (
              <p className="text-xs text-surface-500 font-mono mt-2">
                Equivalente: Bs {calculateEquivalent().toFixed(2)}
              </p>
            )}
          </div>
        </div>

        <div className={isCompact ? 'bg-slate-900 text-white p-4 rounded-xl flex flex-col items-center justify-center' : 'bg-surface-50 p-4 rounded-2xl border border-surface-200 flex flex-col items-center justify-center relative overflow-hidden group'}>
          {!isCompact && <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-brand-500/10 transition-colors" />}
          <span className={`text-[9px] font-bold ${isCompact ? 'text-slate-400' : 'text-surface-500'} uppercase tracking-widest mb-1 relative z-10`}>
            {isCompact ? 'Equivalente' : 'Monto Calculado a Saldar'}
          </span>
          <div className="flex items-baseline gap-1 relative z-10">
            <span className={`text-xs ${isCompact ? 'text-slate-500' : 'text-surface-400'} font-bold`}>Bs</span>
            <span className={`text-3xl font-black ${isCompact ? '' : 'text-surface-900'}`}>{calculateEquivalent().toFixed(2)}</span>
          </div>
          {!isCompact && (
            <div className="w-full mt-4 flex items-center gap-2 relative z-10">
              <div className="h-2 flex-1 bg-surface-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${calculateEquivalent() >= balance ? 'bg-emerald-500' : 'bg-brand-500'}`}
                  style={{ width: `${Math.min(100, (calculateEquivalent() / balance) * 100)}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-surface-400 font-mono">{Math.min(100, (calculateEquivalent() / balance) * 100).toFixed(0)}%</span>
            </div>
          )}
        </div>
      </div>

      <div className={isCompact ? 'space-y-3' : ''}>
        <label className={`text-[10px] font-black ${isCompact ? 'text-slate-500' : 'text-surface-500 mb-3 block'} uppercase tracking-widest`}>Método de Pago</label>
        <div className={`grid ${isCompact ? 'grid-cols-3 gap-2' : 'grid-cols-3 gap-3'}`}>
          {PAYMENT_METHODS.map(m => {
            const Icon = m.icon || DollarSign; // Fallback
            return (
              <button key={m.id} onClick={() => setPayMethod(m.id)}
                className={isCompact 
                  ? `p-2 rounded-lg border text-center transition-all flex flex-col items-center gap-1 ${payMethod === m.id ? 'bg-brand-50 border-brand-500 text-brand-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`
                  : `py-3 px-2 flex flex-col items-center justify-center gap-2 rounded-xl border-2 transition-all group ${payMethod === m.id ? 'bg-brand-50 border-brand-500 text-brand-700' : 'bg-white border-surface-100/50 hover:border-brand-200 hover:bg-surface-50 text-surface-500'}`
                }>
                <Icon size={isCompact ? 14 : 20} className={!isCompact ? (payMethod === m.id ? 'text-brand-500' : 'text-surface-400 group-hover:text-brand-400 transition-colors') : ''} />
                <span className={isCompact ? 'text-[9px] font-bold' : 'text-xs font-bold'}>{m.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Factura (solo modo full) */}
      {!isCompact && setRequireInvoice && (
        <div className="border border-surface-200 rounded-2xl overflow-hidden">
          <label className="flex items-center gap-3 p-4 bg-surface-50 cursor-pointer hover:bg-surface-100 transition-colors">
            <input 
              type="checkbox" 
              className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-surface-300"
              checked={requireInvoice}
              onChange={(e) => setRequireInvoice(e.target.checked)}
            />
            <div className="flex items-center gap-2 text-sm font-bold text-surface-700">
              <FileText size={16} className="text-surface-400" />
              Generar Factura (Recibo)
            </div>
          </label>
          {requireInvoice && (
            <div className="p-4 grid grid-cols-2 gap-4 bg-white border-t border-surface-200">
              <Input label="NIT / CI" value={invoiceData.tax_id} onChange={e => setInvoiceData({...invoiceData, tax_id: e.target.value})} placeholder="Ej: 1234567" />
              <Input label="Razón Social" value={invoiceData.business_name} onChange={e => setInvoiceData({...invoiceData, business_name: e.target.value})} placeholder="Nombre completo" />
            </div>
          )}
        </div>
      )}

      {/* Acciones se renderizan desde el componente padre */}
    </div>
  );
}
