import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api.client';
import ENDPOINTS from '../../config/api.config';
import { Card, Table, Button, Input, Modal, PageHeader, Badge } from '../../components/ui';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

function CompanyForm({ initial = {}, onSave, loading }) {
  const [form, setForm] = useState({
    business_name: '', tax_id: '', email: '', phone: '',
    contact_name: '', corporate_discount: '0', notes: '',
    ...initial,
  });
  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, corporate_discount: parseFloat(form.corporate_discount) }); }} className="flex flex-col gap-3">
      <Input label="Razón social *"       value={form.business_name}      onChange={f('business_name')}      required />
      <div className="grid grid-cols-2 gap-3">
        <Input label="NIT *"              value={form.tax_id}             onChange={f('tax_id')}             required />
        <Input label="Descuento (0-1)"    type="number" step="0.01" min="0" max="1"
               value={form.corporate_discount} onChange={f('corporate_discount')} />
      </div>
      <Input label="Email"                type="email" value={form.email} onChange={f('email')} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Teléfono"           value={form.phone}              onChange={f('phone')} />
        <Input label="Contacto"           value={form.contact_name}       onChange={f('contact_name')} />
      </div>
      <Button type="submit" variant="primary" loading={loading} className="mt-1">
        {initial.id ? 'Guardar cambios' : 'Registrar empresa'}
      </Button>
    </form>
  );
}

export default function CompaniesPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const [modal, setModal]     = useState(null);
  const [selected, setSelected] = useState(null);
  const canCreate = hasPermission('GUESTS_CREATE');
  const canUpdate = hasPermission('GUESTS_UPDATE');

  const { data, isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn:  () => api.get(ENDPOINTS.guest.listCompanies()),
  });

  const create = useMutation({
    mutationFn: (body) => api.post(ENDPOINTS.guest.createCompany(), body),
    onSuccess: () => { qc.invalidateQueries(['companies']); setModal(null); toast.success('Empresa registrada'); },
    onError:   (e) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: ({ id, ...body }) => api.put(ENDPOINTS.guest.updateCompany(id), body),
    onSuccess: () => { qc.invalidateQueries(['companies']); setModal(null); toast.success('Empresa actualizada'); },
    onError:   (e) => toast.error(e.message),
  });

  const columns = [
    { key: 'business_name',      label: 'Razón social' },
    { key: 'tax_id',             label: 'NIT' },
    { key: 'email',              label: 'Email' },
    { key: 'contact_name',       label: 'Contacto' },
    { key: 'corporate_discount', label: 'Descuento',
      render: (v) => <Badge color="green">{(parseFloat(v || 0) * 100).toFixed(0)}%</Badge> },
    canUpdate && { key: 'actions', label: '',
      render: (_, row) => (
        <Button size="sm" variant="ghost" onClick={() => { setSelected(row); setModal('edit'); }}>Editar</Button>
      )
    },
  ].filter(Boolean);

  return (
    <div>
      <PageHeader
        title="Empresas"
        subtitle="Cuentas corporativas y convenios"
        action={canCreate && <Button variant="primary" onClick={() => { setSelected(null); setModal('create'); }}>+ Nueva empresa</Button>}
      />

      <Card>
        <Table columns={columns} data={data?.data || []} loading={isLoading} emptyMsg="No hay empresas registradas" />
      </Card>

      <Modal open={modal === 'create'} onClose={() => setModal(null)} title="Nueva empresa">
        <CompanyForm onSave={(d) => create.mutate(d)} loading={create.isPending} />
      </Modal>

      <Modal open={modal === 'edit'} onClose={() => setModal(null)} title="Editar empresa">
        {selected && (
          <CompanyForm initial={selected} onSave={(d) => update.mutate({ id: selected.id, ...d })} loading={update.isPending} />
        )}
      </Modal>
    </div>
  );
}
