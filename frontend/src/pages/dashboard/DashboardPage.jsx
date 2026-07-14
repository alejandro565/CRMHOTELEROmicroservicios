import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from 'recharts';
import api from '../../services/api.client';
import ENDPOINTS from '../../config/api.config';
import { StatCard, Card, CardHeader, CardBody, Spinner, PageHeader, Button, Input } from '../../components/ui';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  TrendingUp, Bed, Star, Users, Printer, FileText, Search,
  CheckCircle, XCircle, ChevronDown, AlertCircle, Download
} from 'lucide-react';

const defaultFrom = format(subDays(new Date(), 30), 'yyyy-MM-dd');
const defaultTo   = format(new Date(), 'yyyy-MM-dd');

// ─── Print styles injected once ──────────────────────────────────────────────
const PRINT_STYLE = `
  @media print {
    body > *:not(#guest-report-printable) { display: none !important; }
    #guest-report-printable { display: block !important; position: fixed; top: 0; left: 0; width: 100%; }
    #guest-report-printable .no-print { display: none !important; }
  }
`;

// ─── StatusBadge small ───────────────────────────────────────────────────────
function StatusPill({ status }) {
  const map = {
    IN_HOUSE:    { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'En Casa' },
    CHECKED_OUT: { bg: 'bg-slate-100',   text: 'text-slate-600',   label: 'Check-out' },
    CONFIRMED:   { bg: 'bg-indigo-100',  text: 'text-indigo-700',  label: 'Confirmada' },
    PRE_CHECKIN: { bg: 'bg-amber-100',   text: 'text-amber-700',   label: 'Reservado' },
  };
  const s = map[status] || { bg: 'bg-slate-100', text: 'text-slate-500', label: status };
  return (
    <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

// ─── Guest Report Table ───────────────────────────────────────────────────────
function GuestReportTable({ rows, from, to }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <Users size={40} className="mb-3 opacity-30" />
        <p className="text-sm font-medium">No se encontraron huéspedes en el período seleccionado</p>
      </div>
    );
  }

  return (
    <div id="guest-report-printable">
      {/* Print header — only visible on print */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-black text-slate-900">Reporte de Huéspedes</h1>
        <p className="text-sm text-slate-500">Período: {from} — {to} · Total: {rows.length} registros</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-3 py-2.5 text-left font-black text-slate-500 uppercase tracking-widest">Reserva</th>
              <th className="px-3 py-2.5 text-left font-black text-slate-500 uppercase tracking-widest">Huésped</th>
              <th className="px-3 py-2.5 text-left font-black text-slate-500 uppercase tracking-widest">Estado</th>
              <th className="px-3 py-2.5 text-left font-black text-slate-500 uppercase tracking-widest">Origen</th>
              <th className="px-3 py-2.5 text-left font-black text-slate-500 uppercase tracking-widest">Habitación</th>
              <th className="px-3 py-2.5 text-left font-black text-slate-500 uppercase tracking-widest">Entrada</th>
              <th className="px-3 py-2.5 text-left font-black text-slate-500 uppercase tracking-widest">Salida</th>
              <th className="px-3 py-2.5 text-left font-black text-slate-500 uppercase tracking-widest no-print">Doc. Verif.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={`border-b border-slate-50 transition-colors hover:bg-brand-50/20 ${r.is_primary ? 'bg-brand-50/10' : ''}`}>
                <td className="px-3 py-2 font-mono text-slate-400">{r.reservation_id}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    {r.is_primary && <Star size={10} className="text-amber-400 fill-amber-400 shrink-0" />}
                    <span className="font-bold text-slate-800">{r.guest_name}</span>
                  </div>
                </td>
                <td className="px-3 py-2"><StatusPill status={r.status} /></td>
                <td className="px-3 py-2 text-slate-500">{r.origin_country !== '—' ? `${r.origin_city !== '—' ? r.origin_city + ', ' : ''}${r.origin_country}` : '—'}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-col">
                    <span className="font-black text-slate-800">Hab. {r.room_number}</span>
                    <span className="text-[9px] text-slate-400">{r.room_type}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-slate-600 font-medium">{r.check_in_date}</td>
                <td className="px-3 py-2 text-slate-600 font-medium">{r.check_out_date}</td>
                <td className="px-3 py-2 no-print">
                  {r.id_verified
                    ? <CheckCircle size={13} className="text-emerald-500" />
                    : <XCircle size={13} className="text-rose-400" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [reportFrom, setReportFrom] = useState(defaultFrom);
  const [reportTo,   setReportTo]   = useState(defaultTo);
  const [showReport, setShowReport] = useState(false);

  // Inject print styles once
  if (typeof document !== 'undefined' && !document.getElementById('dashboard-print-style')) {
    const style = document.createElement('style');
    style.id = 'dashboard-print-style';
    style.textContent = PRINT_STYLE;
    document.head.appendChild(style);
  }

  const qs = `from=${defaultFrom}&to=${defaultTo}`;

  const { data: live, isLoading: loadingLive } = useQuery({
    queryKey: ['dashboard-live', defaultFrom, defaultTo],
    queryFn: () => api.get(ENDPOINTS.reporting.liveSummary(qs)),
    retry: 1,
  });

  const { data: occ } = useQuery({
    queryKey: ['occupancy'],
    queryFn: () => api.get(ENDPOINTS.reporting.occupancy(qs)),
    retry: 1,
  });

  const { data: pendingRooms } = useQuery({
    queryKey: ['hk-pending'],
    queryFn: () => api.get(ENDPOINTS.hotels.hkPending()),
    retry: 1,
  });

  const reportQs = `from=${reportFrom}&to=${reportTo}`;
  const { data: guestData, isFetching: fetchingReport, refetch: fetchReport } = useQuery({
    queryKey: ['guest-report', reportFrom, reportTo],
    queryFn: () => api.get(ENDPOINTS.reporting.guestReport(reportQs)),
    enabled: showReport,
    retry: 1,
  });

  const guestRows = guestData?.data?.rows || [];

  if (loadingLive) return <div className="flex justify-center items-center h-[50vh]"><Spinner size={40} className="text-brand-500" /></div>;

  const liveData  = live?.data || {};
  const summary   = liveData.summary || {};
  const mostUsed  = liveData.most_used_room || null;
  const allRooms  = liveData.all_rooms_ranked || [];
  const occRows   = occ?.data || [];
  const pendingCount = pendingRooms?.data?.length || 0;

  // Debug: log the live data shape once to verify
  if (live && !liveData.summary) {
    console.warn('[Dashboard] live-summary estructura inesperada:', live);
  }

  const chartData = occRows.slice(-14).map(r => ({
    date:        format(new Date(r.date + 'T12:00:00'), 'd MMM', { locale: es }),
    ocupacion:   parseFloat(r.occupancy_percentage || 0).toFixed(1),
    habitaciones: r.occupied_rooms,
  }));

  // Revenue chart from live data
  const revenueChart = (liveData.daily_revenue || []).slice(-14).map(r => ({
    date:    format(new Date(r.date + 'T12:00:00'), 'd MMM', { locale: es }),
    ingresos: parseFloat(r.total_revenue || 0),
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/90 backdrop-blur-md border border-surface-200 p-3 rounded-xl shadow-xl shadow-brand-500/10">
          <p className="text-surface-500 text-xs font-bold uppercase mb-1">{label}</p>
          {payload.map((entry, i) => (
            <p key={i} className="text-surface-900 font-bold text-sm">
              {entry.name}: <span style={{ color: entry.color }}>{entry.value}{entry.name === 'Ocupación' ? '%' : entry.name === 'Ingresos' ? ' Bs' : ''}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const handlePrint = () => window.print();

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Dashboard Gerencial"
        subtitle={`Resumen en tiempo real · ${format(new Date(), "d 'de' MMMM, yyyy", { locale: es })}`}
        action={
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
              Datos en tiempo real
            </span>
          </div>
        }
      />

      {/* ─── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard
          label="Ingresos Totales"
          value={`Bs ${(summary.total_revenue || 0).toLocaleString('es-BO', { minimumFractionDigits: 0 })}`}
          sub="Pagos registrados · 30 días"
          color="green"
          icon={<TrendingUp size={20} />}
        />
        <StatCard
          label="Reservas Activas"
          value={summary.current_occupied || 0}
          sub={`${summary.reservation_count || 0} completadas este período`}
          color="indigo"
          icon={<Bed size={20} />}
        />
        <StatCard
          label="ADR Promedio"
          value={`Bs ${parseFloat(summary.avg_adr || 0).toFixed(0)}`}
          sub="Tarifa diaria promedio (habitaciones)"
          color="amber"
          icon={<Star size={20} />}
        />
        <StatCard
          label="Hab. Pendientes"
          value={pendingCount}
          sub="HK · Limpieza pendiente"
          color={pendingCount > 0 ? 'red' : 'green'}
          icon={<AlertCircle size={20} />}
        />
      </div>

      {/* ─── Most Used Room + Top Rooms ────────────────────────────────────── */}
      {(mostUsed || allRooms.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Highlight card */}
          {mostUsed && (
            <Card className="bg-gradient-to-br from-brand-600 to-indigo-700 border-none text-white overflow-hidden relative">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full -mr-10 -mt-10" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full -ml-8 -mb-8" />
              </div>
              <CardBody className="relative z-10 py-7">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center shrink-0 backdrop-blur-sm">
                    <Star size={24} className="text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-1">Habitación Más Usada</p>
                    <p className="text-4xl font-black text-white leading-none mb-1">Hab. {mostUsed.room_number}</p>
                    <p className="text-sm font-medium text-white/80">{mostUsed.room_type_name}</p>
                    <p className="text-xs text-white/60 mt-2 font-bold">{mostUsed.count} ocupaciones en el período</p>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Top rooms ranking */}
          {allRooms.length > 0 && (
            <Card className={mostUsed ? 'lg:col-span-2' : 'lg:col-span-3'}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-6 bg-brand-500 rounded-full" />
                  <h3 className="text-sm font-heading font-bold text-surface-900">Ranking de Habitaciones</h3>
                  <span className="ml-auto text-[10px] font-bold text-slate-400 uppercase">Últimos 30 días</span>
                </div>
              </CardHeader>
              <CardBody>
                <div className="space-y-2">
                  {allRooms.map((r, i) => (
                    <div key={r.room_number} className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 
                        ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-white' : i === 2 ? 'bg-orange-300 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-bold text-slate-800">Hab. {r.room_number} <span className="font-normal text-slate-400">· {r.room_type_name}</span></span>
                          <span className="text-[10px] font-black text-brand-600">{r.count} occ.</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5">
                          <div
                            className="bg-gradient-to-r from-brand-500 to-indigo-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${Math.round((r.count / (allRooms[0]?.count || 1)) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {/* ─── Charts ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card hoverEffect className="overflow-hidden">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="w-2 h-6 bg-brand-500 rounded-full" />
              <h3 className="text-lg font-heading font-bold text-surface-900">Ocupación Diaria (%)</h3>
            </div>
          </CardHeader>
          <CardBody>
            {chartData.length === 0 ? (
              <p className="text-surface-400 font-medium text-sm text-center py-12">Sin datos de ocupación suficientes</p>
            ) : (
              <div className="h-[260px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorOcupacion" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} dy={10} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" name="Ocupación" dataKey="ocupacion" stroke="#3b82f6" fill="url(#colorOcupacion)" strokeWidth={3} activeDot={{ r: 6, strokeWidth: 0, fill: '#3b82f6' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>

        <Card hoverEffect className="overflow-hidden">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="w-2 h-6 bg-emerald-500 rounded-full" />
              <h3 className="text-lg font-heading font-bold text-surface-900">Ingresos Diarios (Bs)</h3>
            </div>
          </CardHeader>
          <CardBody>
            {revenueChart.length === 0 ? (
              <p className="text-surface-400 font-medium text-sm text-center py-12">Sin datos de ingresos registrados</p>
            ) : (
              <div className="h-[260px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueChart} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#10b981" />
                        <stop offset="100%" stopColor="#34d399" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} dy={10} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f0fdf4' }} />
                    <Bar name="Ingresos" dataKey="ingresos" fill="url(#colorIngresos)" radius={[6, 6, 0, 0]} barSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* ─── Guest Report Panel ──────────────────────────────────────────────── */}
      <Card className="overflow-hidden border border-slate-200">
        <CardHeader className="bg-slate-50/70 border-b border-slate-100">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-6 bg-indigo-500 rounded-full" />
              <h3 className="text-sm font-heading font-bold text-surface-900">Reporte de Huéspedes</h3>
              {guestRows.length > 0 && (
                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                  {guestRows.length} registros
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Desde</label>
                <input
                  type="date"
                  value={reportFrom}
                  onChange={e => setReportFrom(e.target.value)}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-brand-400 font-medium text-slate-700 bg-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Hasta</label>
                <input
                  type="date"
                  value={reportTo}
                  onChange={e => setReportTo(e.target.value)}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-brand-400 font-medium text-slate-700 bg-white"
                />
              </div>
              <button
                onClick={() => { setShowReport(true); fetchReport(); }}
                disabled={fetchingReport}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-60"
              >
                <Search size={13} />
                {fetchingReport ? 'Buscando...' : 'Generar'}
              </button>
              {guestRows.length > 0 && (
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  <Printer size={13} />
                  Imprimir
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {!showReport ? (
            <div className="flex flex-col items-center justify-center py-14 text-slate-400 gap-3">
              <FileText size={36} className="opacity-30" />
              <p className="text-sm font-medium">Selecciona un rango de fechas y haz clic en Generar</p>
            </div>
          ) : fetchingReport ? (
            <div className="flex justify-center py-12"><Spinner size={32} className="text-brand-500" /></div>
          ) : (
            <div className="p-5">
              <GuestReportTable rows={guestRows} from={reportFrom} to={reportTo} />
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
