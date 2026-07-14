import React, { useState } from 'react';
import { Receipt, ArrowRight, CreditCard, PlusCircle, CheckCircle } from 'lucide-react';
import { Button } from '../../ui';
import useFolioManager from '../../billing/hooks/useFolioManager';
import FolioSummary from '../../billing/shared/FolioSummary';
import FolioModal from '../../billing/FolioModal';

export default function BillingTab({ reservation, onCheckOut, isCheckingOut }) {
  const [folioModalOpen, setFolioModalOpen] = useState(false);
  const fm = useFolioManager(reservation.id, 'summary');

  return (
    <>
      <div className="flex gap-6 animate-fade-in h-[500px]">
        
        {/* Left: Summary & Balances */}
        <FolioSummary 
          balance={fm.balance} charges={fm.charges} payments={fm.payments}
          loadingCharges={fm.loadingFolio} loadingPayments={fm.loadingFolio}
          activeTab={fm.activeTab} setActiveTab={fm.setActiveTab}
          folioStatus={fm.folio?.status} layout="compact"
        />

        {/* Right: Action Buttons */}
        <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-5">
          
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-2">
            <Receipt size={34} />
          </div>

          <div>
            <h4 className="text-lg font-black text-slate-900 mb-1">Gestión de Cuenta</h4>
            <p className="text-sm text-slate-400 max-w-xs mx-auto">
              Abre el gestor de folio para registrar pagos, agregar cargos o cerrar la cuenta.
            </p>
          </div>

          <div className="flex flex-col gap-3 w-full max-w-xs mt-2">

            {/* Primary action: open FolioModal */}
            {fm.folio?.status === 'OPEN' && (
              <button
                onClick={() => setFolioModalOpen(true)}
                className="w-full h-13 flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl font-bold text-sm text-white shadow-lg shadow-brand-500/25 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
              >
                <CreditCard size={18} />
                {fm.balance > 0 ? 'Gestionar Pagos y Cobros' : 'Gestionar Cuenta / Folio'}
              </button>
            )}

            {/* Settled badge */}
            {fm.folio?.status === 'SETTLED' && (
              <div className="flex items-center justify-center gap-2 py-3 px-5 bg-emerald-50 border border-emerald-200 rounded-xl">
                <CheckCircle size={18} className="text-emerald-500" />
                <span className="text-sm font-bold text-emerald-700">Cuenta Cerrada / Liquidada</span>
              </div>
            )}

            {/* Check-out button */}
            {reservation.status === 'IN_HOUSE' && (
              <button
                disabled={isCheckingOut || fm.balance !== 0}
                onClick={onCheckOut}
                className={`w-full h-12 flex items-center justify-center gap-2 px-6 rounded-xl font-bold text-sm transition-all duration-200
                  ${fm.balance === 0
                    ? 'bg-slate-900 text-white hover:bg-slate-700 shadow-md hover:scale-[1.02] active:scale-[0.98]'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  }`}
              >
                <ArrowRight size={16} />
                {fm.balance !== 0 ? 'Salda la cuenta para hacer Check-out' : 'Realizar Check-out'}
              </button>
            )}

          </div>

          {fm.balance > 0 && (
            <p className="text-[11px] text-amber-500 font-semibold mt-1">
              Saldo pendiente: Bs {fm.balance.toFixed(2)}
            </p>
          )}

        </div>
      </div>

      {/* FolioModal opens on top of StayManagerModal */}
      <FolioModal
        isOpen={folioModalOpen}
        onClose={() => setFolioModalOpen(false)}
        reservationId={reservation.id}
        onFolioSettled={() => setFolioModalOpen(false)}
      />
    </>
  );
}
