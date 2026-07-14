import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api.client';
import ENDPOINTS from '../../config/api.config';
import { Card, CardHeader, CardBody, Table, Button, Input, Modal, PageHeader, Badge } from '../../components/ui';
import toast from 'react-hot-toast';

function RoomTypeForm({ initial = {}, onSave, loading }) {
  const [form, setForm] = useState({
    name: '', description: '', max_capacity: '2', base_price: '',
    amenities: '[]',
    ...initial,
    amenities: JSON.stringify(initial.amenities || []),
  });
  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSave = (e) => {
    e.preventDefault();
    let amenities = [];
    try { amenities = JSON.parse(form.amenities); } catch {}
    onSave({ ...form, max_capacity: parseInt(form.max_capacity), base_price: parseFloat(form.base_price), amenities });
  };

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-3">
      <Input label="Nombre *"           value={form.name}        onChange={f('name')}        required placeholder="Ej: Suite Presidencial" />
      <Input label="Descripción"        value={form.description} onChange={f('description')} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Capacidad máx *"  type="number" min="1"  value={form.max_capacity} onChange={f('max_capacity')} required />
        <Input label="Precio base (BOB) *" type="number" min="0" value={form.base_price} onChange={f('base_price')}  required />
      </div>
      <Input label='Amenities (JSON array, ej: ["WiFi","TV"])' value={form.amenities} onChange={f('amenities')} />
      <Button type="submit" variant="primary" loading={loading}>
        {initial.id ? 'Guardar cambios' : 'Crear tipo'}
      </Button>
    </form>
  );
}

export default function RoomTypesPage() {
  const qc = useQueryClient();
  const [modal, setModal]       = useState(null);
  const [selected, setSelected] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['room-types'],
    queryFn:  () => api.get(ENDPOINTS.hotels.listRoomTypes()),
  });

  const create = useMutation({
    mutationFn: (body) => api.post(ENDPOINTS.hotels.createRoomType(), body),
    onSuccess: () => { qc.invalidateQueries(['room-types']); setModal(null); toast.success('Tipo creado'); },
    onError:   (e) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: ({ id, ...body }) => api.put(ENDPOINTS.hotels.updateRoomType(id), body),
    onSuccess: () => { qc.invalidateQueries(['room-types']); setModal(null); toast.success('Tipo actualizado'); },
    onError:   (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id) => api.delete(ENDPOINTS.hotels.deleteRoomType(id)),
    onSuccess: () => { qc.invalidateQueries(['room-types']); toast.success('Tipo eliminado'); },
    onError:   (e) => toast.error(e.message),
  });

  const columns = [
    { key: 'name',         label: 'Nombre' },
    { key: 'max_capacity', label: 'Capacidad',   render: (v) => `${v} pers.` },
    { key: 'base_price',   label: 'Precio base', render: (v) => <span className="font-medium">Bs {parseFloat(v).toFixed(2)}</span> },
    { key: 'amenities',    label: 'Amenities',
      render: (v) => (
        <div className="flex flex-wrap gap-1">
          {(v || []).slice(0, 3).map(a => <Badge key={a} color="blue">{a}</Badge>)}
          {(v || []).length > 3 && <Badge color="gray">+{v.length - 3}</Badge>}
        </div>
      )
    },
    { key: 'actions', label: '',
      render: (_, row) => (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => { setSelected(row); setModal('edit'); }}>Editar</Button>
          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => remove.mutate(row.id)}>Eliminar</Button>
        </div>
      )
    },
  ];

  return (
    <div>
      <PageHeader
        title="Tipos de habitación"
        subtitle="Categorías y precios base"
        action={<Button variant="primary" onClick={() => { setSelected(null); setModal('create'); }}>+ Nuevo tipo</Button>}
      />

      <Card>
        <Table columns={columns} data={data || []} loading={isLoading} emptyMsg="No hay tipos configurados" />
      </Card>

      <Modal open={modal === 'create'} onClose={() => setModal(null)} title="Nuevo tipo de habitación" size="sm">
        <RoomTypeForm onSave={(d) => create.mutate(d)} loading={create.isPending} />
      </Modal>

      <Modal open={modal === 'edit'} onClose={() => setModal(null)} title="Editar tipo" size="sm">
        {selected && (
          <RoomTypeForm initial={selected} onSave={(d) => update.mutate({ id: selected.id, ...d })} loading={update.isPending} />
        )}
      </Modal>
    </div>
  );
}
