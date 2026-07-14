import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api.client';
import ENDPOINTS from '../../config/api.config';
import { Card, Table, Button, PageHeader, StatusBadge, Badge, StatCard, Input, Select } from '../../components/ui';
import { Search, UserCog, Calendar, Bed, ExternalLink, Filter, Package } from 'lucide-react';
import { format } from 'date-fns';
import StayManagerModal from '../../components/reservations/StayManagerModal';

export default function ActiveStaysPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedResId, setSelectedResId] = useState(null);

  // Fetch only active/operational statuses
  const { data, isLoading } = useQuery({
    queryKey: ['active-stays', statusFilter],
    queryFn: async () => {
      const res = await api.get(ENDPOINTS.reservation.listReservations(statusFilter ? `status=${statusFilter}` : ''));
      // Clientside filtering for operational states if no statusFilter is set
      if (!statusFilter) {
        return {
          ...res,
          data: res.data.filter(r => ['CONFIRMED', 'PRE_CHECKIN', 'IN_HOUSE'].includes(r.status))
        };
      }
      return res;
    },
  });

  const rows = data?.data || [];

  // Clientside search
  const filteredRows = rows.filter(r => {
    const mainGuest = r.main_guest_name?.toLowerCase() || '';
    const roomNumber = r.rooms?.some(rm => rm.room_number?.toLowerCase().includes(search.toLowerCase()));
    return mainGuest.includes(search.toLowerCase()) || roomNumber || r.id.includes(search);
  });

  const columns = [
    { 
      key: 'main_guest_name', 
      label: 'Titular', 
      render: (v, row) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-800">{v || 'N/A'}</span>
          <span className="text-[10px] text-slate-400 font-mono italic">{row.id.slice(0,8)}</span>
        </div>
      )
    },
    { 
      key: 'status', 
      label: 'Estado', 
      render: (v) => <StatusBadge status={v} /> 
    },
    { 
      key: 'rooms', 
      label: 'Habitación / Tipo', 
      render: (rooms) => (
        <div className="flex flex-col gap-1">
          {rooms?.map(rm => (
            <div key={rm.id} className="flex items-center gap-2">
              <Badge color={rm.room_number ? 'indigo' : 'gray'}>
                {rm.room_number ? `Hab. ${rm.room_number}` : 'Pendiente'}
              </Badge>
              <span className="text-xs text-slate-500">{rm.room_type_name}</span>
            </div>
          ))}
        </div>
      )
    },
    { 
      key: 'dates', 
      label: 'Estancia', 
      render: (_, row) => {
        const firstRoom = row.rooms?.[0];
        if (!firstRoom) return '—';
        return (
          <div className="text-xs font-medium text-slate-600">
            {format(new Date(firstRoom.check_in_date + 'T12:00'), 'dd MMM')} - {format(new Date(firstRoom.check_out_date + 'T12:00'), 'dd MMM')}
          </div>
        );
      }
    },
    { 
      key: 'pending_balance', 
      label: 'Saldo', 
      render: (v) => {
        const balance = parseFloat(v || 0);
        if (balance <= 0) return <Badge color="green" size="sm">Pagado</Badge>;
        return (
          <div className="flex flex-col">
            <span className="text-xs font-black text-rose-600">Bs {balance.toFixed(2)}</span>
            <span className="text-[9px] font-bold text-rose-400 uppercase tracking-tighter">Pendiente</span>
          </div>
        );
      }
    },
    { 
      key: 'loans', 
      label: 'Objetos', 
      render: (_, row) => {
        const totalLoans = row.rooms?.reduce((acc, rm) => acc + (rm.loans?.length || 0), 0);
        if (totalLoans === 0) return <span className="text-xs text-slate-300">—</span>;
        return (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 text-amber-700 rounded-lg border border-amber-100 w-fit">
            <Package size={12} />
            <span className="text-xs font-black">{totalLoans}</span>
          </div>
        );
      }
    },
    { 
      key: 'actions', 
      label: '', 
      render: (_, row) => (
        <Button 
          size="sm" 
          variant="ghost" 
          onClick={() => setSelectedResId(row.id)}
          className="hover:bg-brand-50 hover:text-brand-700 transition-colors"
        >
          <UserCog size={16} className="mr-2" /> Gestionar
        </Button>
      ) 
    },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Gestión Operativa"
        subtitle="Administración de reservas confirmadas y huéspedes en casa"
        action={
          <div className="flex items-center gap-3">
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <Input 
                  placeholder="Buscar huésped o habitación..." 
                  className="pl-10 w-64 bg-white/50 backdrop-blur-sm border-slate-200"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
             </div>
          </div>
        }
      />

      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Por llegar (Confirmadas)" value={rows.filter(r => r.status === 'CONFIRMED').length} color="indigo" icon={<Calendar size={20} />} />
        <StatCard label="Pre-Check-In (Datos portal)" value={rows.filter(r => r.status === 'PRE_CHECKIN').length} color="amber" icon={<ExternalLink size={20} />} />
        <StatCard label="En casa (Activas)" value={rows.filter(r => r.status === 'IN_HOUSE').length} color="emerald" icon={<Bed size={20} />} />
        <StatCard label="Filtros activos" value={statusFilter || 'Todos'} color="slate" icon={<Filter size={20} />} />
      </div>

      <Card className="overflow-hidden border-none shadow-xl shadow-slate-200/50">
        <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
           <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Estancias en curso</h3>
           <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase">Filtrar por:</span>
              <Select 
                value={statusFilter} 
                onChange={e => setStatusFilter(e.target.value)}
                className="w-40 h-8 text-xs font-bold"
              >
                <option value="">TODOS</option>
                <option value="CONFIRMED">CONFIRMADAS</option>
                <option value="PRE_CHECKIN">PRE-CHECKIN</option>
                <option value="IN_HOUSE">EN CASA</option>
              </Select>
           </div>
        </div>
        <Table 
          columns={columns} 
          data={filteredRows} 
          loading={isLoading} 
          emptyMsg="No se encontraron estancias activas que coincidan con la búsqueda." 
        />
      </Card>

      {selectedResId && (
        <StayManagerModal 
          isOpen={true} 
          onClose={() => setSelectedResId(null)} 
          reservationId={selectedResId}
          onUpdate={() => qc.invalidateQueries(['active-stays'])}
        />
      )}
    </div>
  );
}
