import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api.client';
import ENDPOINTS from '../../config/api.config';
import { Card, Table, Button, Input, Modal, PageHeader, Badge } from '../../components/ui';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

function InvoiceForm({ onSave, loading }) {
  const [form, setForm] = useState({ folio_id: '', nit_ci: '', razon_social: '', email: '' });
  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="flex flex-col gap-3">
      <Input label="ID de folio *"   value={form.folio_id}     onChange={f('folio_id')}     placeholder="UUID del folio" required />
      <Input label="NIT / CI *"      value={form.nit_ci}       onChange={f('nit_ci')}       required />
      <Input label="Razón social *"  value={form.razon_social} onChange={f('razon_social')} required />
      <Input label="Email (recibe factura)" type="email" value={form.email} onChange={f('email')} />
      <p className="text-xs text-gray-400">El folio debe tener saldo cero antes de emitir la factura.</p>
      <Button type="submit" variant="primary" loading={loading}>Emitir factura</Button>
    </form>
  );
}

export default function InvoicesPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn:  () => api.get(ENDPOINTS.billing.listInvoices()),
    retry: 1,
  });

  const generate = useMutation({
    mutationFn: ({ folio_id, ...body }) => api.post(ENDPOINTS.billing.genInvoice(folio_id), body),
    onSuccess: () => { qc.invalidateQueries(['invoices']); setModal(false); toast.success('Factura emitida'); },
    onError:   (e) => toast.error(e.message),
  });

  const sinColors = { ACCEPTED: 'green', PENDING: 'yellow', REJECTED: 'red' };

  const columns = [
    { key: 'created_at',   label: 'Fecha',
      render: (v) => v ? format(new Date(v), 'dd/MM/yy HH:mm') : '—' },
    { key: 'razon_social', label: 'Razón social' },
    { key: 'nit_ci',       label: 'NIT / CI' },
    { key: 'total_amount', label: 'Total',
      render: (v) => <span className="font-medium">Bs {parseFloat(v).toFixed(2)}</span> },
    { key: 'sin_status',   label: 'SIN',
      render: (v) => <Badge color={sinColors[v] || 'gray'}>{v}</Badge> },
    { key: 'cuf',          label: 'CUF',
      render: (v) => v ? <span className="font-mono text-xs text-gray-500">{String(v).slice(0, 16)}…</span> : '—' },
  ];

  return (
    <div>
      <PageHeader
        title="Facturas fiscales"
        subtitle="Emisión al SIN Bolivia"
        action={<Button variant="primary" onClick={() => setModal(true)}>+ Emitir factura</Button>}
      />

      <Card>
        <Table columns={columns} data={data?.data || []} loading={isLoading} emptyMsg="No hay facturas emitidas" />
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="Emitir factura fiscal" size="sm">
        <InvoiceForm onSave={(d) => generate.mutate(d)} loading={generate.isPending} />
      </Modal>
    </div>
  );
}
