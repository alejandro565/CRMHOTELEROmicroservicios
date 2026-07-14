import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api.client';
import ENDPOINTS from '../../config/api.config';
import { Card, Table, Button, Select, Modal, PageHeader, StatusBadge, Badge, StatCard, Input } from '../../components/ui';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import CheckInModal from '../../components/reservations/CheckInModal';
import FolioModal from '../../components/billing/FolioModal';

const STATUS_OPTIONS = ['', 'CONFIRMED', 'PRE_CHECKIN', 'IN_HOUSE', 'CHECKED_OUT', 'CANCELED', 'NOSHOW'];

function ReservationDetail({ res, onClose, onOpenFolio }) {
  const qc = useQueryClient();

  const checkIn = useMutation({
    mutationFn: () => api.post(ENDPOINTS.reservation.checkIn(res.id), {}),
    onSuccess: () => { qc.invalidateQueries(['reservations']); toast.success('Check-in realizado'); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  const checkOut = useMutation({
    mutationFn: () => api.post(ENDPOINTS.reservation.checkOut(res.id), {}),
    onSuccess: () => { qc.invalidateQueries(['reservations']); toast.success('Check-out realizado'); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: () => api.patch(ENDPOINTS.reservation.cancel(res.id), {}),
    onSuccess: () => { qc.invalidateQueries(['reservations']); toast.success('Reserva cancelada'); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <StatusBadge status={res.status} />
        <span className="text-sm text-gray-500 font-mono">{res.id.slice(0, 8)}…</span>
        <Badge color="blue">{res.source}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-gray-500">Total:</span> <strong>Bs {parseFloat(res.total_price || 0).toFixed(2)}</strong></div>
        <div><span className="text-gray-500">Descuento:</span> {((res.discount_applied || 0) * 100).toFixed(0)}%</div>
      </div>

      {res.rooms?.map((room, i) => (
        <div key={room.id} className="bg-gray-50 rounded-lg p-3 text-sm">
          <p className="font-medium">{room.room_type_name}</p>
          <p className="text-gray-500">
            {room.check_in_date} → {room.check_out_date} · Bs {parseFloat(room.rate_per_night).toFixed(0)} x {room.adults + room.children} pers/noche
          </p>
          {room.room_number && <p className="text-indigo-600 font-medium mt-1">Hab. {room.room_number}</p>}
        </div>
      ))}

      <div className="flex gap-2 flex-wrap pt-2 border-t border-gray-100">
        {res.status === 'CONFIRMED' && (
          <Button variant="primary" onClick={() => checkIn.mutate()} loading={checkIn.isPending} size="sm">
            Check-in
          </Button>
        )}
        {res.status === 'IN_HOUSE' && (
          <Button variant="success" onClick={() => checkOut.mutate()} loading={checkOut.isPending} size="sm">
            Check-out
          </Button>
        )}
        {['CONFIRMED', 'PRE_CHECKIN'].includes(res.status) && (
          <Button variant="danger" onClick={() => cancel.mutate()} loading={cancel.isPending} size="sm">
            Cancelar
          </Button>
        )}
        <div className="flex-1" />
        {['IN_HOUSE', 'CHECKED_OUT', 'PRE_CHECKIN'].includes(res.status) && (
          <Button variant="secondary" onClick={onOpenFolio} size="sm" className="bg-surface-900 border-surface-900 text-white hover:bg-surface-800">
            Ver Cuenta (Folio)
          </Button>
        )}
      </div>
    </div>
  );
}

export default function ReservationsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [folioResId, setFolioResId] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['reservations', statusFilter],
    queryFn: () => api.get(ENDPOINTS.reservation.listReservations(statusFilter ? `status=${statusFilter}` : '')),
  });

  const rows = data?.data || [];
  const inHouse   = rows.filter(r => r.status === 'IN_HOUSE').length;
  const confirmed = rows.filter(r => r.status === 'CONFIRMED').length;
  const today     = rows.filter(r => r.rooms?.some(room => room.check_in_date === format(new Date(), 'yyyy-MM-dd'))).length;

  const columns = [
    { key: 'id',          label: 'ID',      render: (v) => <span className="font-mono text-xs text-gray-500">{v.slice(0,8)}…</span> },
    { key: 'status',      label: 'Estado',  render: (v) => <StatusBadge status={v} /> },
    { key: 'source',      label: 'Origen',  render: (v) => <Badge color="gray">{v}</Badge> },
    { key: 'total_price', label: 'Total',   render: (v) => `Bs ${parseFloat(v).toFixed(2)}` },
    { key: 'created_at',  label: 'Creada',  render: (v) => v ? format(new Date(v), 'dd/MM/yy') : '—' },
    { key: 'actions',     label: '',
      render: (_, row) => <Button size="sm" variant="ghost" onClick={() => setSelected(row)}>Ver</Button>
    },
  ];

  return (
    <div>
      <PageHeader
        title="Reservas"
        subtitle="Gestión del ciclo de vida de estadías"
        action={
          <Button
            variant="success"
            onClick={() => setShowCheckIn(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 flex items-center gap-2"
          >
            ✦ Walk-in Check-in
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="En casa"      value={inHouse}   color="green" />
        <StatCard label="Confirmadas"  value={confirmed} color="indigo" />
        <StatCard label="Llegan hoy"   value={today}     color="amber" />
      </div>

      <Card>
        <div className="px-5 py-3 border-b border-gray-100">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="max-w-xs">
            <option value="">Todos los estados</option>
            {STATUS_OPTIONS.filter(Boolean).map(s => <option key={s}>{s}</option>)}
          </Select>
        </div>
        <Table columns={columns} data={rows} loading={isLoading} emptyMsg="No hay reservas" />
      </Card>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Detalle de reserva" size="md">
        {selected && (
          <ReservationDetail 
            res={selected} 
            onClose={() => setSelected(null)} 
            onOpenFolio={() => { setFolioResId(selected.id); setSelected(null); }}
          />
        )}
      </Modal>

      <FolioModal 
        isOpen={!!folioResId} 
        onClose={() => setFolioResId(null)} 
        reservationId={folioResId} 
        onFolioSettled={() => qc.invalidateQueries(['reservations'])}
      />

      <CheckInModal
        isOpen={showCheckIn}
        onClose={() => setShowCheckIn(false)}
        onSuccess={() => qc.invalidateQueries(['reservations'])}
      />
    </div>
  );
}
