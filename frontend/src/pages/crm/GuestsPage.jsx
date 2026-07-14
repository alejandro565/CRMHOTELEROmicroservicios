import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api.client';
import ENDPOINTS from '../../config/api.config';
import { Card, Table, Button, Input, Select, Modal, PageHeader, StatusBadge, Badge } from '../../components/ui';
import GuestFormFields from '../../components/guests/GuestFormFields';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

const DOC_TYPES = ['CI', 'PASSPORT', 'FOREIGN_ID', 'OTHER'];

const GuestForm = ({ onSave, loading, initial = {} }) => {
  const [form, setForm] = useState({
    first_name: '', last_name: '', doc_type: 'CI', doc_number: '',
    email: '', phone: '', nationality: 'Boliviano', civil_status: '',
    ...initial,
  });

  const update = (f, v) => {
    if (typeof f === 'object') {
      setForm(p => ({ ...p, ...f }));
    } else {
      setForm(p => ({ ...p, [f]: v }));
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="flex flex-col gap-3">
      <GuestFormFields 
        values={form} 
        onChange={(k, v) => setForm(p => ({ ...p, [k]: v }))} 
      />
      <Button type="submit" variant="primary" loading={loading} className="mt-2">
        {initial.id ? 'Guardar cambios' : 'Registrar huésped'}
      </Button>
    </form>
  );
}

export default function GuestsPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const [search, setSearch]   = useState('');
  const [modal, setModal]     = useState(null);  // null | 'create' | 'edit'
  const [selected, setSelected] = useState(null);
  const canCreate = hasPermission('GUESTS_CREATE');
  const canUpdate = hasPermission('GUESTS_UPDATE');

  const { data, isLoading } = useQuery({
    queryKey: ['guests', search],
    queryFn: () => api.get(ENDPOINTS.guest.listGuests(search ? `search=${encodeURIComponent(search)}` : '')),
  });

  const create = useMutation({
    mutationFn: (body) => api.post(ENDPOINTS.guest.createGuest(), body),
    onSuccess: () => { qc.invalidateQueries(['guests']); setModal(null); toast.success('Huésped registrado'); },
    onError: (e) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: ({ id, ...body }) => api.put(ENDPOINTS.guest.updateGuest(id), body),
    onSuccess: () => { qc.invalidateQueries(['guests']); setModal(null); toast.success('Huésped actualizado'); },
    onError: (e) => toast.error(e.message),
  });

  const columns = [
    { key: 'full_name',   label: 'Nombre',    render: (_, r) => `${r.first_name} ${r.last_name}` },
    { key: 'doc_type',    label: 'Tipo doc',  render: (v) => <Badge color="gray">{v}</Badge> },
    { key: 'doc_number',  label: 'Documento' },
    { key: 'email',       label: 'Email' },
    { key: 'nationality', label: 'Nac.' },
    canUpdate && { key: 'actions',     label: '',
      render: (_, row) => (
        <Button size="sm" variant="ghost" onClick={() => { setSelected(row); setModal('edit'); }}>
          Editar
        </Button>
      )
    },
  ].filter(Boolean);

  return (
    <div>
      <PageHeader
        title="Huéspedes"
        subtitle="Perfil, documentación y lealtad"
        action={canCreate && <Button variant="primary" onClick={() => { setSelected(null); setModal('create'); }}>+ Nuevo huesped</Button>}
      />

      <Card>
        <div className="px-5 py-3 border-b border-gray-100">
          <Input
            placeholder="Buscar por nombre, documento o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <Table
          columns={columns}
          data={data?.data || []}
          loading={isLoading}
          emptyMsg="No hay huéspedes registrados"
        />
      </Card>

      <Modal open={modal === 'create'} onClose={() => setModal(null)} title="Nuevo huésped">
        <GuestForm onSave={(d) => create.mutate(d)} loading={create.isPending} />
      </Modal>

      <Modal open={modal === 'edit'} onClose={() => setModal(null)} title="Editar huésped">
        {selected && (
          <GuestForm
            initial={selected}
            onSave={(d) => update.mutate({ id: selected.id, ...d })}
            loading={update.isPending}
          />
        )}
      </Modal>
    </div>
  );
}
