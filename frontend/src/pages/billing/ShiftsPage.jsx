import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api.client';
import ENDPOINTS from '../../config/api.config';
import { Card, CardHeader, CardBody, Table, PageHeader, Badge, StatCard } from '../../components/ui';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function ShiftsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['shift-reports'],
    queryFn:  () => api.get(ENDPOINTS.reporting.shifts()),
    retry: 1,
  });

  const shifts = data?.data || [];

  const totalCollected  = shifts.reduce((s, r) => s + parseFloat(r.expected_cash || 0), 0);
  const totalDifference = shifts.reduce((s, r) => s + parseFloat(r.difference    || 0), 0);
  const problematic     = shifts.filter(r => Math.abs(parseFloat(r.difference || 0)) > 0).length;

  const columns = [
    { key: 'closed_at',    label: 'Fecha cierre',
      render: (v) => v ? format(new Date(v), "dd/MM/yy HH:mm", { locale: es }) : '—' },
    { key: 'user_id',      label: 'Cajero',
      render: (v) => <span className="font-mono text-xs text-gray-500">{String(v).slice(0, 8)}…</span> },
    { key: 'expected_cash', label: 'Esperado (BOB)',
      render: (v) => <span className="font-medium">Bs {parseFloat(v).toFixed(2)}</span> },
    { key: 'actual_cash',   label: 'Contado (BOB)',
      render: (v) => <span className="font-medium">Bs {parseFloat(v).toFixed(2)}</span> },
    { key: 'difference',    label: 'Diferencia',
      render: (v) => {
        const d = parseFloat(v);
        if (d === 0) return <Badge color="green">Cuadrado</Badge>;
        return <Badge color={d > 0 ? 'red' : 'yellow'}>{d > 0 ? 'Faltante' : 'Sobrante'} Bs {Math.abs(d).toFixed(2)}</Badge>;
      }
    },
  ];

  return (
    <div>
      <PageHeader title="Historial de turnos" subtitle="Arqueos de caja por cajero" />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Total recaudado"    value={`Bs ${totalCollected.toLocaleString('es-BO', { minimumFractionDigits: 0 })}`} color="green" />
        <StatCard label="Diferencia total"   value={`Bs ${Math.abs(totalDifference).toFixed(2)}`} color={totalDifference !== 0 ? 'red' : 'green'} />
        <StatCard label="Turnos con errores" value={problematic} color={problematic > 0 ? 'red' : 'green'} />
      </div>

      <Card>
        <Table columns={columns} data={shifts} loading={isLoading} emptyMsg="No hay turnos cerrados aún" />
      </Card>
    </div>
  );
}
