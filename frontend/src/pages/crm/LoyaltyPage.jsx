import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api.client';
import ENDPOINTS from '../../config/api.config';
import { Card, CardBody, Button, Input, Modal, PageHeader, Badge, StatCard } from '../../components/ui';
import toast from 'react-hot-toast';

function LevelCard({ level, onEdit, onDelete }) {
  const pct = (parseFloat(level.discount_percentage || 0) * 100).toFixed(0);
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 text-base">{level.name}</h3>
          {level.is_default && <Badge color="gray" className="mt-1">Base</Badge>}
        </div>
        <span className="text-2xl font-bold text-indigo-600">{pct}%</span>
      </div>
      <div className="text-sm text-gray-500">
        Mínimo <strong className="text-gray-800">{level.min_stays}</strong> estadías para calificar
      </div>
      {level.description && <p className="text-xs text-gray-400">{level.description}</p>}
      {!level.is_default && (
        <div className="flex gap-2 pt-2 border-t border-gray-50">
          <Button size="sm" variant="ghost" onClick={() => onEdit(level)}>Editar</Button>
          <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => onDelete(level.id)}>Eliminar</Button>
        </div>
      )}
    </div>
  );
}

function LevelForm({ initial = {}, onSave, loading }) {
  const [form, setForm] = useState({
    name: '', min_stays: '0', discount_percentage: '0', description: '',
    ...initial,
    discount_percentage: String((parseFloat(initial.discount_percentage || 0))),
  });
  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, min_stays: parseInt(form.min_stays), discount_percentage: parseFloat(form.discount_percentage) }); }} className="flex flex-col gap-3">
      <Input label="Nombre del nivel *" value={form.name} onChange={f('name')} placeholder="Ej: Oro" required />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Estadías mínimas" type="number" min="0" value={form.min_stays}           onChange={f('min_stays')} />
        <Input label="Descuento (0-1)"  type="number" step="0.01" min="0" max="1"
               value={form.discount_percentage} onChange={f('discount_percentage')} placeholder="0.10 = 10%" />
      </div>
      <Input label="Descripción" value={form.description} onChange={f('description')} />
      <p className="text-xs text-gray-400">El descuento se aplica automáticamente en reservas nuevas.</p>
      <Button type="submit" variant="primary" loading={loading}>
        {initial.id ? 'Guardar cambios' : 'Crear nivel'}
      </Button>
    </form>
  );
}

export default function LoyaltyPage() {
  const qc = useQueryClient();
  const [modal, setModal]       = useState(null);
  const [selected, setSelected] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['loyalty-levels'],
    queryFn:  () => api.get(ENDPOINTS.guest.listLevels()),
  });

  const levels = data?.data || [];

  const create = useMutation({
    mutationFn: (body) => api.post(ENDPOINTS.guest.createLevel(), body),
    onSuccess: () => { qc.invalidateQueries(['loyalty-levels']); setModal(null); toast.success('Nivel creado'); },
    onError:   (e) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: ({ id, ...body }) => api.put(ENDPOINTS.guest.updateLevel(id), body),
    onSuccess: () => { qc.invalidateQueries(['loyalty-levels']); setModal(null); toast.success('Nivel actualizado'); },
    onError:   (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id) => api.delete(ENDPOINTS.guest.deleteLevel(id)),
    onSuccess: () => { qc.invalidateQueries(['loyalty-levels']); toast.success('Nivel eliminado'); },
    onError:   (e) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Niveles de lealtad"
        subtitle="Motor de fidelización — descuentos automáticos por estadías acumuladas"
        action={<Button variant="primary" onClick={() => { setSelected(null); setModal('create'); }}>+ Nuevo nivel</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <StatCard label="Niveles configurados" value={levels.length}       color="indigo" />
        <StatCard label="Descuento máximo"     value={`${Math.max(0, ...levels.map(l => parseFloat(l.discount_percentage || 0) * 100)).toFixed(0)}%`} color="green" />
        <StatCard label="Estadías para máx."   value={Math.max(0, ...levels.map(l => l.min_stays || 0))} color="amber" />
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-gray-400">Cargando...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {levels.sort((a, b) => a.min_stays - b.min_stays).map(level => (
            <LevelCard
              key={level.id}
              level={level}
              onEdit={(l) => { setSelected(l); setModal('edit'); }}
              onDelete={(id) => remove.mutate(id)}
            />
          ))}
        </div>
      )}

      <Modal open={modal === 'create'} onClose={() => setModal(null)} title="Nuevo nivel de lealtad" size="sm">
        <LevelForm onSave={(d) => create.mutate(d)} loading={create.isPending} />
      </Modal>

      <Modal open={modal === 'edit'} onClose={() => setModal(null)} title="Editar nivel" size="sm">
        {selected && (
          <LevelForm initial={selected} onSave={(d) => update.mutate({ id: selected.id, ...d })} loading={update.isPending} />
        )}
      </Modal>
    </div>
  );
}
