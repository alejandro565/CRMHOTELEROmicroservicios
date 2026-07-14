import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle } from 'lucide-react';

export default function FolioSummary({
  balance, charges, payments, loadingCharges, loadingPayments,
  activeTab, setActiveTab, folioStatus, layout = 'full'
}) {
  const isCompact = layout === 'compact';

  return (
    <div className={`flex flex-col h-full ${isCompact ? 'w-full' : 'w-1/3 bg-surface-50 border-r border-surface-200 p-6'}`}>
      <div className={`${isCompact ? 'bg-slate-900 text-white rounded-2xl p-5 shadow-xl' : 'bg-white border text-center border-surface-200 rounded-2xl p-5 shadow-sm'} mb-6`}>
        <p className={`text-[10px] font-bold ${isCompact ? 'text-slate-400' : 'text-surface-500'} uppercase tracking-widest mb-1 ${isCompact ? 'text-center' : ''}`}>
          Saldo Pendiente
        </p>
        <div className="flex items-center justify-center gap-1.5">
          <span className={`${isCompact ? 'text-slate-500' : 'text-surface-400'} font-bold`}>Bs</span>
          <span className={`text-4xl font-black tracking-tight ${balance > 0 ? (isCompact ? 'text-brand-400' : 'text-brand-600') : (isCompact ? 'text-emerald-400' : 'text-emerald-500')}`}>
            {balance.toFixed(2)}
          </span>
        </div>
        {balance === 0 && <p className={`text-xs ${isCompact ? 'text-emerald-400' : 'text-emerald-600'} font-bold mt-2 flex items-center justify-center gap-1`}><CheckCircle size={12}/> Cuenta saldada</p>}
      </div>

      <div className={`flex-1 flex flex-col min-h-0 ${isCompact ? 'bg-slate-50 rounded-2xl border border-slate-200 p-4' : ''}`}>
        {!isCompact && (
          <div className="flex bg-surface-200/50 p-1 rounded-xl mb-6 shrink-0">
            <button 
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${activeTab === 'summary' ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500 hover:text-surface-700'}`}
              onClick={() => setActiveTab('summary')}
            >Detalle</button>
            {balance > 0 && folioStatus === 'OPEN' && (
              <button 
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${activeTab === 'pay' ? 'bg-brand-600 shadow-sm text-white' : 'text-brand-600 hover:text-brand-700'}`}
                onClick={() => setActiveTab('pay')}
              >Pagar</button>
            )}
          </div>
        )}

        {(activeTab === 'summary' || isCompact) && (
          <div className={`flex-1 overflow-y-auto custom-scrollbar ${isCompact ? '' : 'space-y-4'}`}>
            <div className={`${isCompact ? 'mb-4' : ''}`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className={`text-[10px] font-black ${isCompact ? 'text-slate-500' : 'text-surface-400'} uppercase tracking-widest`}>
                  Cargos ({loadingCharges ? '...' : `Bs ${charges.reduce((a,c) => a + Number(c.amount), 0).toFixed(2)}`})
                </h3>
                {!isCompact && (
                  <button onClick={() => setActiveTab('add_charge')} className="text-[10px] font-bold bg-surface-200 hover:bg-surface-300 text-surface-700 px-2 py-0.5 rounded transition-colors">
                    + Gasto
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {charges.length === 0 ? <p className="text-xs text-surface-400 italic">Sin cargos</p> : null}
                {charges.map(c => (
                  <div key={c.id} className="flex justify-between items-start text-[11px] sm:text-sm">
                    <div className="min-w-0 flex-1 pr-2">
                      <p className={`font-medium truncate ${isCompact ? 'text-slate-700 font-bold' : 'text-surface-700'}`} title={c.description}>
                        {c.category === 'ACCOMMODATION' ? 'Cargo por Hospedaje' : c.description}
                      </p>
                      <p className="text-[9px] sm:text-[10px] text-surface-400 font-mono">
                        {(() => {
                          if (!c.created_at && !c.createdAt) return '—';
                          const d = new Date(c.created_at || c.createdAt);
                          if (isNaN(d.getTime())) return 'Invalid Date';
                          return format(d, 'dd/MM HH:mm', { locale: es });
                        })()}
                      </p>
                    </div>
                    <span className={`font-mono ${isCompact ? 'text-slate-900' : 'text-surface-900'} shrink-0`}>{(Number(c.amount)).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className={`h-px ${isCompact ? 'bg-slate-200 my-4' : 'bg-surface-200 my-4 w-full'}`} />
            
            <div>
              <h3 className={`text-[10px] font-black ${isCompact ? 'text-emerald-500' : 'text-emerald-500'} uppercase tracking-widest mb-2 flex justify-between`}>
                <span>Pagos</span>
                <span>{loadingPayments ? '...' : `Bs ${payments.reduce((a,p) => a + Number(p.amount_base), 0).toFixed(2)}`}</span>
              </h3>
              <div className="space-y-2">
                {payments.length === 0 ? <p className="text-xs text-surface-400 italic">Sin pagos</p> : null}
                {payments.map(p => (
                  <div key={p.id} className="flex justify-between items-start text-[11px] sm:text-sm">
                    <div className="min-w-0 flex-1 pr-2">
                      <p className={`font-medium ${isCompact ? 'text-emerald-600 font-bold' : 'text-emerald-700'}`}>{p.method}</p>
                      <p className="text-[9px] sm:text-[10px] text-surface-400 font-mono">
                        {p.received_currency !== 'BOB' ? `${p.received_amount} ${p.received_currency}` : `Bs ${p.received_amount}`}
                      </p>
                    </div>
                    <span className="font-mono text-emerald-600 shrink-0">{(Number(p.amount_base)).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
