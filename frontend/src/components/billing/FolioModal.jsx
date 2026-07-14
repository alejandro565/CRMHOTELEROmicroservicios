import React from 'react';
import { createPortal } from 'react-dom';
import { Spinner, Button } from '../ui';
import { X, Receipt, Download, Banknote } from 'lucide-react';
import useFolioManager from './hooks/useFolioManager';
import FolioSummary from './shared/FolioSummary';
import FolioPaymentForm from './shared/FolioPaymentForm';
import FolioChargeForm from './shared/FolioChargeForm';

export default function FolioModal({ isOpen, onClose, reservationId, onFolioSettled }) {
  const fm = useFolioManager(reservationId, 'summary', () => {
    if (onFolioSettled) onFolioSettled();
    onClose();
  });

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-surface-950/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-4xl rounded-[24px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-surface-900 px-6 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface-800 flex items-center justify-center text-white">
              <Receipt size={20} />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg leading-tight flex items-center gap-2">
                Estado de Cuenta
                {fm.folio?.status === 'OPEN' && <span className="bg-amber-500/20 text-amber-300 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">Abierta</span>}
                {fm.folio?.status === 'SETTLED' && <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">Pagada</span>}
              </h2>
              <p className="text-surface-400 text-xs">Folio: <span className="font-mono text-surface-300">{fm.folio?.id?.slice(0,8) || 'Cargando...'}</span></p>
            </div>
          </div>
          <button onClick={() => { fm.resetState(); onClose(); }} className="text-surface-400 hover:text-white transition-colors bg-surface-800 hover:bg-surface-700 p-2 rounded-xl">
            <X size={18} />
          </button>
        </div>

        {fm.loadingFolio ? (
          <div className="flex-1 flex items-center justify-center p-12"><Spinner className="text-brand-500 w-8 h-8" /></div>
        ) : !fm.folio ? (
           <div className="flex-1 flex flex-col items-center justify-center p-12 text-surface-400">
             <Receipt size={48} className="mb-4 opacity-50" />
             <p>No se encontró información del folio.</p>
           </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            
            <FolioSummary 
              balance={fm.balance} charges={fm.charges} payments={fm.payments}
              loadingCharges={false} loadingPayments={false}
              activeTab={fm.activeTab} setActiveTab={fm.setActiveTab}
              folioStatus={fm.folio.status} layout="full"
            />

            {/* Right Panel - Dynamic Action Zone */}
            <div className="w-2/3 bg-white p-8 relative overflow-y-auto">
              
              {fm.activeTab === 'summary' && (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                  <div className="w-24 h-24 bg-brand-50 rounded-full flex items-center justify-center">
                    <Receipt size={40} className="text-brand-300" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-surface-900 mb-2">Gestión de Folio</h3>
                    <p className="text-surface-500 max-w-sm mx-auto text-sm">
                      Aquí puedes revisar todos los cargos y abonos realizados a esta reserva.
                    </p>
                  </div>
                  {fm.balance > 0 && fm.folio.status === 'OPEN' && (
                    <Button 
                      variant="primary"
                      onClick={() => fm.setActiveTab('pay')} 
                      className="shadow-lg shadow-brand-500/20 px-8 py-3 text-lg font-bold w-64 rounded-xl"
                    >
                      Realizar Pago
                    </Button>
                  )}
                  {fm.balance < 0 && fm.folio.status === 'OPEN' && (
                    <Button 
                      variant="brand"
                      onClick={() => fm.setActiveTab('refund')} 
                      className="shadow-lg shadow-amber-500/20 px-8 py-3 text-lg font-bold w-64 rounded-xl"
                    >
                      Registrar Vuelto
                    </Button>
                  )}
                  {fm.balance === 0 && fm.folio.status === 'OPEN' && (
                    <Button 
                      variant="success"
                      onClick={fm.handleSettle} 
                      loading={fm.isSettling} 
                      className="shadow-lg shadow-emerald-500/20 px-8 py-3 text-lg font-bold w-64 rounded-xl"
                    >
                      Cerrar Cuenta
                    </Button>
                  )}
                </div>
              )}

              {fm.activeTab === 'pay' && fm.balance > 0 && (
                <div className="animate-slide-in-right">
                  <FolioPaymentForm 
                    payAmount={fm.payAmount} setPayAmount={fm.setPayAmount}
                    currency={fm.currency} setCurrency={fm.setCurrency}
                    rates={fm.rates} calculateEquivalent={fm.calculateEquivalent}
                    balance={fm.balance} payMethod={fm.payMethod} setPayMethod={fm.setPayMethod}
                    requireInvoice={fm.requireInvoice} setRequireInvoice={fm.setRequireInvoice}
                    invoiceData={fm.invoiceData} setInvoiceData={fm.setInvoiceData}
                    layout="full"
                  />
                  <div className="flex gap-3 pt-6">
                    <Button variant="secondary" onClick={() => fm.setActiveTab('summary')} className="px-6 py-3 font-bold rounded-xl text-surface-600 h-12">
                      Cancelar
                    </Button>
                    <Button 
                      variant="primary" fullWidth
                      onClick={fm.handlePartialPayment} loading={fm.isAddingPayment} disabled={fm.isSettling}
                      className="font-bold rounded-xl h-12"
                    >
                      Registrar Pago
                    </Button>
                  </div>
                </div>
              )}

              {fm.activeTab === 'refund' && fm.balance < 0 && (
                <div className="space-y-8 animate-slide-in-right">
                  {/* ... (Refund content from original) ... */}
                  <div>
                    <h3 className="text-xl font-black text-surface-900 flex items-center gap-2 mb-1">
                      <Banknote className="text-amber-500" /> Registrar Vuelto
                    </h3>
                    <p className="text-sm text-surface-400">Hay un saldo a favor del huésped por sobrepago.</p>
                  </div>
                  <div className="bg-surface-50 p-6 rounded-2xl border border-amber-200 shadow-inner">
                    <p className="text-xs font-bold text-surface-500 uppercase tracking-widest mb-1 text-center">Monto exacto a devolver</p>
                    <div className="flex items-end justify-center gap-1.5 mb-4">
                      <span className="text-amber-500 font-bold mb-1">Bs</span>
                      <span className="text-5xl font-black text-amber-500">{Math.abs(fm.balance).toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button variant="secondary" onClick={() => fm.setActiveTab('summary')} className="px-6 py-3 font-bold rounded-xl text-surface-600 h-12">Cancelar</Button>
                    <Button variant="danger" onClick={fm.handleRefund} loading={fm.isAddingPayment} className="flex-1 font-bold rounded-xl h-12">Confirmar Entrega de Vuelto</Button>
                  </div>
                </div>
              )}

              {fm.activeTab === 'add_charge' && (
                <div className="animate-slide-in-right">
                  <FolioChargeForm 
                    chargeCategory={fm.chargeCategory} setChargeCategory={fm.setChargeCategory}
                    chargeDesc={fm.chargeDesc} setChargeDesc={fm.setChargeDesc}
                    chargeAmount={fm.chargeAmount} setChargeAmount={fm.setChargeAmount}
                    layout="full"
                  />
                  <div className="flex gap-3 pt-6">
                    <Button variant="secondary" onClick={() => fm.setActiveTab('summary')} className="px-6 py-3 font-bold rounded-xl text-surface-600 h-12">
                      Cancelar
                    </Button>
                    <Button variant="primary" onClick={fm.handleAddCharge} loading={fm.isAddingCharge} className="flex-1 font-bold rounded-xl h-12">
                      Registrar Cargo
                    </Button>
                  </div>
                </div>
              )}

              {fm.activeTab === 'invoice' && (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-6 animate-zoom-in">
                  <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 mb-2 shadow-inner">
                    <Receipt size={40} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-surface-900 mb-2">¡Cuenta Cerrada!</h3>
                    <p className="text-surface-500">El pago se ha procesado y la factura ha sido generada con éxito.</p>
                  </div>
                  <div className="flex items-center gap-4 mt-8">
                    <Button onClick={() => { if(onFolioSettled) onFolioSettled(); onClose(); }} variant="secondary" className="px-8 font-bold rounded-xl">Regresar</Button>
                    <Button variant="primary" className="px-8 font-bold rounded-xl shadow-lg shadow-brand-500/20 flex items-center gap-2">
                      <Download size={18} /> Descargar PDF
                    </Button>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
