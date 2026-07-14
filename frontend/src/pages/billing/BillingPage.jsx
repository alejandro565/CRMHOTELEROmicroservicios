import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api.client';
import ENDPOINTS from '../../config/api.config';
import { Card, CardHeader, CardBody, Button, Input, Select, Modal, PageHeader, Badge, StatCard, Table, Spinner } from '../../components/ui';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import {
  Wallet, Clock, AlertCircle, CheckCircle2, TrendingUp,
  ArrowUpRight, ArrowDownRight, CreditCard, Banknote, Search,
  FileText, Receipt, DollarSign, XCircle, Eye
} from 'lucide-react';

// ─── Shift Panel ──────────────────────────────────────────────────────────────
function ShiftPanel() {
  const qc = useQueryClient();
  const [startingCash, setStartingCash] = useState('200');
  const [actualCash, setActualCash] = useState('');
  const [closeModal, setCloseModal] = useState(false);

  const { data: shift, isLoading, error } = useQuery({
    queryKey: ['current-shift'],
    queryFn: () => api.get(ENDPOINTS.billing.currentShift()),
    retry: false,
  });

  const openShift = useMutation({
    mutationFn: () => api.post(ENDPOINTS.billing.openShift(), { starting_cash: parseFloat(startingCash) }),
    onSuccess: () => { qc.invalidateQueries(['current-shift']); toast.success('Turno abierto'); },
    onError: (e) => toast.error(e.message),
  });

  const closeShift = useMutation({
    mutationFn: () => api.post(ENDPOINTS.billing.closeShift(shift?.data?.shift_id), { actual_cash: parseFloat(actualCash) }),
    onSuccess: () => { qc.invalidateQueries(['current-shift']); setCloseModal(false); toast.success('Turno cerrado'); },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <Spinner />;

  const noShift = error || !shift?.data;

  if (noShift) {
    return (
      <div className="bg-gradient-to-br from-surface-50 to-white border-2 border-dashed border-surface-200 rounded-2xl p-8 text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
          <Clock size={28} className="text-amber-500" />
        </div>
        <h3 className="text-lg font-bold text-surface-900 mb-1">Sin turno abierto</h3>
        <p className="text-sm text-surface-500 mb-6 max-w-md mx-auto">
          Abre un turno de caja para registrar pagos y llevar el arqueo. El fondo inicial es el efectivo con el que empiezas.
        </p>
        <div className="flex gap-3 items-end justify-center">
          <div className="text-left">
            <label className="text-xs font-bold text-surface-500 uppercase tracking-wider">Fondo inicial (BOB)</label>
            <input
              type="number"
              value={startingCash}
              onChange={e => setStartingCash(e.target.value)}
              className="mt-1 block w-48 rounded-xl border border-surface-200 px-4 py-2.5 text-sm font-medium text-surface-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
            />
          </div>
          <Button variant="primary" onClick={() => openShift.mutate()} loading={openShift.isPending}>
            <Wallet size={16} className="mr-2" /> Abrir turno
          </Button>
        </div>
      </div>
    );
  }

  const d = shift.data;
  const totals = d.expected_totals || {};

  return (
    <>
      {/* Active shift banner */}
      <div className="bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border border-emerald-500/20 rounded-2xl p-6">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <CheckCircle2 size={20} className="text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-emerald-800 uppercase tracking-wider">Turno activo</h3>
              <p className="text-xs text-surface-500 mt-0.5">
                Abierto a las {d.opened_at ? new Date(d.opened_at).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }) : '—'}
              </p>
            </div>
          </div>
          <Button size="sm" variant="danger" onClick={() => setCloseModal(true)}>
            <XCircle size={14} className="mr-1" /> Cerrar turno
          </Button>
        </div>

        {/* Big total */}
        <div className="mb-5">
          <p className="text-xs text-surface-500 font-bold uppercase tracking-wider mb-1">Total esperado en caja</p>
          <p className="text-4xl font-black text-surface-900">{d.summary_in_base_currency}</p>
        </div>

        {/* Breakdown by method */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Object.entries(totals).map(([method, currencies]) => (
            <div key={method} className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-surface-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                {method.toLowerCase().includes('efectivo') || method.toLowerCase().includes('cash')
                  ? <Banknote size={14} className="text-emerald-500" />
                  : <CreditCard size={14} className="text-brand-500" />
                }
                <p className="text-xs text-surface-500 font-bold uppercase tracking-wider">{method}</p>
              </div>
              {Object.entries(currencies).map(([currency, amount]) => (
                <p key={currency} className="text-lg font-black text-surface-900">
                  {amount.toFixed(2)} <span className="text-xs font-bold text-surface-400">{currency}</span>
                </p>
              ))}
            </div>
          ))}
        </div>
      </div>

      <Modal open={closeModal} onClose={() => setCloseModal(false)} title="Cerrar turno" size="sm">
        <div className="flex flex-col gap-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex gap-3">
              <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">Ingresa el efectivo físico contado en caja para calcular el arqueo. Las diferencias se registrarán automáticamente.</p>
            </div>
          </div>
          <Input label="Efectivo contado (BOB)" type="number" value={actualCash} onChange={e => setActualCash(e.target.value)} />
          <Button variant="danger" onClick={() => closeShift.mutate()} loading={closeShift.isPending}>Confirmar cierre de turno</Button>
        </div>
      </Modal>
    </>
  );
}

// ─── Folio Card (inline) ──────────────────────────────────────────────────────
function FolioCard({ folio }) {
  const [expanded, setExpanded] = useState(false);
  const statusColor = {
    OPEN:    { bg: 'bg-emerald-500/10', text: 'text-emerald-700', border: 'border-emerald-500/20' },
    SETTLED: { bg: 'bg-surface-100',    text: 'text-surface-600',  border: 'border-surface-200' },
    CANCELLED: { bg: 'bg-red-500/10',   text: 'text-red-700',      border: 'border-red-500/20' },
  };
  const st = statusColor[folio.status] || statusColor.OPEN;
  const balance = parseFloat(folio.balance || 0);

  return (
    <div className={`bg-white border ${balance > 0 ? 'border-amber-500/30' : 'border-surface-100'} rounded-xl overflow-hidden transition-all hover:shadow-md`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-surface-50/50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-lg ${folio.type === 'MASTER' ? 'bg-brand-500/10' : 'bg-purple-500/10'} flex items-center justify-center shrink-0`}>
            {folio.type === 'MASTER'
              ? <FileText size={16} className="text-brand-600" />
              : <Receipt size={16} className="text-purple-600" />
            }
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-surface-400">{folio.type}</span>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${st.bg} ${st.text}`}>{folio.status}</span>
            </div>
            <p className="text-xs font-mono text-surface-400 mt-0.5 truncate">{folio.id.slice(0, 12)}…</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className={`text-lg font-black ${balance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              Bs {balance.toFixed(2)}
            </p>
            <p className="text-[10px] text-surface-400 font-bold uppercase">{balance > 0 ? 'Pendiente' : 'Saldado'}</p>
          </div>
          <Eye size={16} className={`text-surface-300 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-surface-100 px-4 pb-4 pt-3 space-y-3 bg-surface-50/30">
          {folio.charges?.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-surface-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                <ArrowUpRight size={11} /> Cargos
              </p>
              <div className="space-y-1">
                {folio.charges.map(c => (
                  <div key={c.id} className="flex justify-between text-sm py-1.5 px-3 bg-white rounded-lg">
                    <span className="text-surface-700 text-xs">{c.description}</span>
                    <span className={`text-xs font-bold ${parseFloat(c.amount) < 0 ? 'text-red-500' : 'text-surface-900'}`}>
                      {parseFloat(c.amount) < 0 ? '-' : ''}Bs {Math.abs(parseFloat(c.amount)).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {folio.payments?.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-surface-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                <ArrowDownRight size={11} /> Pagos
              </p>
              <div className="space-y-1">
                {folio.payments.map(p => (
                  <div key={p.id} className="flex justify-between text-sm py-1.5 px-3 bg-white rounded-lg">
                    <span className="text-surface-700 text-xs">{p.method} · {p.received_currency}</span>
                    <span className="text-xs font-bold text-emerald-600">Bs {parseFloat(p.amount_base).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(!folio.charges?.length && !folio.payments?.length) && (
            <p className="text-xs text-surface-400 text-center py-2">Sin movimientos registrados</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BillingPage() {
  const { hasPermission } = useAuth();
  const [resId, setResId] = useState('');
  const [searchedId, setSearchedId] = useState('');
  const [tab, setTab] = useState('pending');  // 'pending' | 'payments' | 'search'
  const canManageCashier = hasPermission('BILLING_CASHIER');

  // Search by reservation
  const { data: folios, isLoading: loadingFolios } = useQuery({
    queryKey: ['folios', searchedId],
    queryFn: () => api.get(ENDPOINTS.billing.foliosByRes(searchedId)),
    enabled: !!searchedId,
    retry: false,
  });

  // All pending (OPEN) folios
  const { data: pendingFolios, isLoading: loadingPending } = useQuery({
    queryKey: ['all-folios-open'],
    queryFn: () => api.get(ENDPOINTS.billing.listAllFolios('status=OPEN&limit=50')),
    refetchInterval: 30000,
  });

  // All payments (recent)
  const { data: allPayments, isLoading: loadingPayments } = useQuery({
    queryKey: ['all-payments'],
    queryFn: () => api.get(ENDPOINTS.billing.listAllPayments('limit=50')),
    refetchInterval: 30000,
  });

  const folioPairs = folios?.data || [];
  const openFolios = pendingFolios?.data || [];
  const payments   = allPayments?.data || [];

  // Compute summary stats
  const totalPending = openFolios.reduce((sum, f) => sum + parseFloat(f.balance || 0), 0);
  const totalPaid    = payments.reduce((sum, p) => sum + parseFloat(p.amount_base || 0), 0);

  const tabs = [
    { id: 'pending',  label: 'Folios Pendientes', icon: <AlertCircle size={15} />, count: openFolios.length },
    { id: 'payments', label: 'Historial de Pagos', icon: <DollarSign size={15} />,  count: payments.length },
    { id: 'search',   label: 'Buscar por Reserva', icon: <Search size={15} /> },
  ];

  return (
    <div className="min-h-screen bg-surface-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-surface-100 px-8 py-8">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div>
            <h1 className="text-3xl font-heading font-black text-surface-900 flex items-center gap-3">
              <div className="p-2 bg-brand-500/10 rounded-xl text-brand-600">
                <Wallet size={26} />
              </div>
              Cajas y Pagos
            </h1>
            <p className="text-surface-500 text-sm mt-1">Control de caja, folios pendientes e historial de transacciones</p>
          </div>
        </div>

        {/* ── Stats Dashboard ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-white to-surface-50/50 border border-surface-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <AlertCircle size={16} className="text-amber-500" />
              </div>
              <p className="text-xs text-surface-400 font-bold uppercase tracking-widest">Folios abiertos</p>
            </div>
            <h3 className="text-3xl font-black text-surface-900">{openFolios.length}</h3>
            <p className="text-xs text-surface-500 mt-1 font-medium">Bs {totalPending.toFixed(2)} pendientes</p>
          </div>

          <div className="bg-gradient-to-br from-white to-surface-50/50 border border-surface-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp size={16} className="text-emerald-500" />
              </div>
              <p className="text-xs text-surface-400 font-bold uppercase tracking-widest">Pagos recibidos</p>
            </div>
            <h3 className="text-3xl font-black text-surface-900">{payments.length}</h3>
            <p className="text-xs text-surface-500 mt-1 font-medium">Bs {totalPaid.toFixed(2)} cobrados</p>
          </div>

          <div className="bg-gradient-to-br from-white to-surface-50/50 border border-surface-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center">
                <DollarSign size={16} className="text-brand-500" />
              </div>
              <p className="text-xs text-surface-400 font-bold uppercase tracking-widest">Ratio de cobro</p>
            </div>
            <h3 className="text-3xl font-black text-surface-900">
              {(totalPending + totalPaid) > 0 ? ((totalPaid / (totalPending + totalPaid)) * 100).toFixed(0) : 100}%
            </h3>
            <p className="text-xs text-surface-500 mt-1 font-medium">Del total facturado</p>
          </div>
        </div>

        {/* ── Tab selector ── */}
        <div className="flex gap-2 border-t border-surface-100/70 pt-4">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border-2
                ${tab === t.id
                  ? 'bg-brand-500 border-brand-500 text-white shadow-sm'
                  : 'bg-white border-surface-200 text-surface-600 hover:border-surface-300'
                }`}
            >
              {t.icon}
              {t.label}
              {t.count !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-black ${tab === t.id ? 'bg-white/20' : 'bg-surface-100'}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-8 py-6 space-y-6">

        {/* Shift panel always at top if user can manage cashier */}
        {canManageCashier && (
          <ShiftPanel />
        )}

        {/* TAB: Pending Folios */}
        {tab === 'pending' && (
          <div>
            <h2 className="text-sm font-bold text-surface-500 uppercase tracking-widest mb-4">
              Folios con saldo pendiente
            </h2>
            {loadingPending ? (
              <div className="flex justify-center py-10"><Spinner /></div>
            ) : openFolios.length === 0 ? (
              <div className="text-center py-12 bg-white border border-surface-100 rounded-2xl">
                <CheckCircle2 size={36} className="mx-auto text-emerald-400 mb-3" />
                <p className="text-surface-500 font-medium">No hay folios pendientes</p>
                <p className="text-xs text-surface-400 mt-1">Todos los cargos están saldados</p>
              </div>
            ) : (
              <div className="space-y-3">
                {openFolios.map(f => <FolioCard key={f.id} folio={f} />)}
              </div>
            )}
          </div>
        )}

        {/* TAB: Payment History */}
        {tab === 'payments' && (
          <div>
            <h2 className="text-sm font-bold text-surface-500 uppercase tracking-widest mb-4">
              Historial de pagos recientes
            </h2>
            {loadingPayments ? (
              <div className="flex justify-center py-10"><Spinner /></div>
            ) : payments.length === 0 ? (
              <div className="text-center py-12 bg-white border border-surface-100 rounded-2xl">
                <DollarSign size={36} className="mx-auto text-surface-300 mb-3" />
                <p className="text-surface-500 font-medium">Sin pagos registrados</p>
              </div>
            ) : (
              <div className="bg-white border border-surface-100 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-surface-50/70 border-b border-surface-100">
                        <th className="text-left text-[10px] font-black text-surface-400 uppercase tracking-widest px-4 py-3">Fecha</th>
                        <th className="text-left text-[10px] font-black text-surface-400 uppercase tracking-widest px-4 py-3">Método</th>
                        <th className="text-left text-[10px] font-black text-surface-400 uppercase tracking-widest px-4 py-3">Moneda</th>
                        <th className="text-right text-[10px] font-black text-surface-400 uppercase tracking-widest px-4 py-3">Monto original</th>
                        <th className="text-right text-[10px] font-black text-surface-400 uppercase tracking-widest px-4 py-3">Monto (BOB)</th>
                        <th className="text-left text-[10px] font-black text-surface-400 uppercase tracking-widest px-4 py-3">Folio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p, i) => (
                        <tr key={p.id} className={`border-b border-surface-50 hover:bg-surface-50/50 transition-colors ${i % 2 === 0 ? '' : 'bg-surface-50/20'}`}>
                          <td className="px-4 py-3 text-xs text-surface-600">
                            {new Date(p.created_at).toLocaleDateString('es-BO')} {new Date(p.created_at).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-surface-700">
                              {p.method?.toLowerCase().includes('efectivo') || p.method?.toLowerCase().includes('cash')
                                ? <Banknote size={12} className="text-emerald-500" />
                                : <CreditCard size={12} className="text-brand-500" />
                              }
                              {p.method}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs font-bold text-surface-500">{p.received_currency}</td>
                          <td className="px-4 py-3 text-right text-xs font-bold text-surface-700">
                            {parseFloat(p.amount_received || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-xs font-black text-emerald-600">Bs {parseFloat(p.amount_base).toFixed(2)}</span>
                          </td>
                          <td className="px-4 py-3 text-xs font-mono text-surface-400">
                            {p.folio?.id?.slice(0, 8) || p.folio_id?.slice(0, 8) || '—'}…
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: Search by Reservation */}
        {tab === 'search' && (
          <div>
            <div className="bg-white border border-surface-100 rounded-2xl p-6 mb-6">
              <h3 className="text-sm font-bold text-surface-700 mb-3 flex items-center gap-2">
                <Search size={16} className="text-brand-500" />
                Buscar folios por reserva
              </h3>
              <div className="flex gap-3">
                <input
                  placeholder="ID de reserva (UUID)..."
                  value={resId}
                  onChange={e => setResId(e.target.value)}
                  className="flex-1 rounded-xl border border-surface-200 px-4 py-2.5 text-sm text-surface-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                />
                <Button variant="primary" onClick={() => setSearchedId(resId)}>Buscar</Button>
              </div>
            </div>

            {loadingFolios && <div className="flex justify-center py-10"><Spinner /></div>}

            {searchedId && !loadingFolios && folioPairs.length === 0 && (
              <div className="text-center py-12 bg-white border border-surface-100 rounded-2xl">
                <Search size={36} className="mx-auto text-surface-300 mb-3" />
                <p className="text-surface-500 font-medium">No se encontraron folios para esta reserva</p>
              </div>
            )}

            {folioPairs.length > 0 && (
              <div className="space-y-3">
                {folioPairs.map(folio => <FolioCard key={folio.id} folio={folio} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
