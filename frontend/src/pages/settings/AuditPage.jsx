import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api.client';
import ENDPOINTS from '../../config/api.config';
import { Card, Table, Input, Select, PageHeader, Badge, StatCard } from '../../components/ui';
import { format } from 'date-fns';

const MODULES  = ['', 'RESERVATIONS', 'BILLING', 'GUESTS', 'HOTELS', 'USERS', 'SAAS', 'AUTH'];
const ACTIONS  = ['', 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'VOID'];

export default function AuditPage() {
  const [mod,    setMod]    = useState('');
  const [action, setAction] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['audit', mod, action],
    queryFn: () => {
      const qs = [mod && `module=${mod}`, action && `action=${action}`].filter(Boolean).join('&');
      return api.get(ENDPOINTS.audit.all(qs || ''));
    },
    retry: 1,
  });

  const { data: anomalies } = useQuery({
    queryKey: ['anomalies'],
    queryFn: () => api.get(ENDPOINTS.audit.anomalies()),
    retry: 1,
  });

  const rows = data?.data || [];
  const suspicious = anomalies?.data?.suspicious_users || [];

  const columns = [
    { key: 'occurred_at', label: 'Fecha',   render: (v) => v ? format(new Date(v), 'dd/MM/yy HH:mm') : '—' },
    { key: 'action',      label: 'Acción',  render: (v) => {
      const colors = { CREATE: 'green', UPDATE: 'blue', DELETE: 'red', LOGIN: 'indigo', VOID: 'yellow' };
      return <Badge color={colors[v] || 'gray'}>{v}</Badge>;
    }},
    { key: 'module', label: 'Módulo', render: (v) => <Badge color="gray">{v}</Badge> },
    { key: 'entity_id', label: 'Entidad', render: (v) => v ? <span className="font-mono text-xs text-gray-500">{String(v).slice(0, 12)}…</span> : '—' },
    { key: 'user_id',   label: 'Usuario',  render: (v) => v ? <span className="font-mono text-xs">{String(v).slice(0, 8)}…</span> : 'Sistema' },
  ];

  return (
    <div>
      <PageHeader title="Auditoría" subtitle="Trazabilidad de todas las acciones del sistema" />

      {suspicious.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5">
          <p className="text-sm font-semibold text-red-700 mb-2">⚠ Actividad sospechosa detectada</p>
          {suspicious.map(u => (
            <p key={u.user_id} className="text-sm text-red-600">
              Usuario <span className="font-mono">{u.user_id.slice(0, 8)}…</span> realizó {u.void_count} anulaciones en la última hora
            </p>
          ))}
        </div>
      )}

      <Card>
        <div className="px-5 py-3 border-b border-gray-100 flex gap-3 flex-wrap">
          <Select value={mod}    onChange={e => setMod(e.target.value)}    className="w-44">
            {MODULES.map(m  => <option key={m}  value={m}>{m  || 'Todos los módulos'}</option>)}
          </Select>
          <Select value={action} onChange={e => setAction(e.target.value)} className="w-44">
            {ACTIONS.map(a  => <option key={a}  value={a}>{a  || 'Todas las acciones'}</option>)}
          </Select>
        </div>
        <Table
          columns={columns}
          data={rows}
          loading={isLoading}
          emptyMsg="No hay registros de auditoría"
        />
      </Card>
    </div>
  );
}
