import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api.client';
import ENDPOINTS from '../../config/api.config';
import { Card, CardHeader, CardBody, Button, Input, PageHeader, StatCard } from '../../components/ui';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

export default function ReportsPage() {
  const currentYear  = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [from, setFrom] = useState(`${currentYear}-01-01`);
  const [to,   setTo]   = useState(format(new Date(), 'yyyy-MM-dd'));
  const [libroYear,  setLibroYear]  = useState(String(currentYear));
  const [libroMonth, setLibroMonth] = useState(String(currentMonth));

  const { data: sales, isLoading } = useQuery({
    queryKey: ['sales', from, to],
    queryFn: () => api.get(ENDPOINTS.reporting.salesReport(`from=${from}&to=${to}`)),
    retry: 1,
  });

  const salesData = sales?.data?.rows || [];
  const grandTotal = sales?.data?.grand_total || 0;

  const chartData = salesData.map(r => ({
    date:    r.date?.slice(5), // MM-DD
    revenue: parseFloat(r.total_revenue || 0),
  }));

  const downloadExcel = async (url, filename = 'reporte.xlsx') => {
    const token = localStorage.getItem('crm_token');
    try {
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) { toast.error('Error al generar el reporte'); return; }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      toast.error('Error al descargar el archivo');
    }
  };

  return (
    <div>
      <PageHeader title="Reportes" subtitle="Análisis financiero y cumplimiento legal" />

      {/* Sales report */}
      <Card className="mb-6">
        <CardHeader className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Reporte de ventas</h3>
          <Button
            size="sm"
            variant="default"
            onClick={() => downloadExcel(ENDPOINTS.reporting.salesReport(`from=${from}&to=${to}&format=xlsx`), `ventas-${from}.xlsx`)}
          >
            ↓ Excel
          </Button>
        </CardHeader>
        <CardBody>
          <div className="flex gap-3 mb-5 flex-wrap">
            <Input label="Desde" type="date" value={from} onChange={e => setFrom(e.target.value)} />
            <Input label="Hasta" type="date" value={to}   onChange={e => setTo(e.target.value)}   />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-5">
            <StatCard label="Total período" value={`Bs ${parseFloat(grandTotal).toLocaleString('es-BO', { minimumFractionDigits: 2 })}`} color="green" />
            <StatCard label="Días con datos" value={salesData.length} color="indigo" />
          </div>

          {chartData.length > 0 && (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v) => [`Bs ${v.toFixed(2)}`, 'Ingresos']} />
                <Area type="monotone" dataKey="revenue" stroke="#6366f1" fill="url(#rev)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardBody>
      </Card>

      {/* Libro de Ventas */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Libro de Ventas (SIN)</h3>
            <p className="text-xs text-gray-400 mt-0.5">Cumplimiento tributario mensual</p>
          </div>
          <Button
            size="sm"
            variant="primary"
            onClick={() => downloadExcel(ENDPOINTS.reporting.libroVentas(`year=${libroYear}&month=${libroMonth}&format=xlsx`), `libro-ventas-${libroMonth}-${libroYear}.xlsx`)}
          >
            ↓ Descargar Excel
          </Button>
        </CardHeader>
        <CardBody>
          <div className="flex gap-3">
            <Input label="Año"  type="number" value={libroYear}  onChange={e => setLibroYear(e.target.value)}  className="w-28" />
            <Input label="Mes"  type="number" min="1" max="12" value={libroMonth} onChange={e => setLibroMonth(e.target.value)} className="w-24" />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
