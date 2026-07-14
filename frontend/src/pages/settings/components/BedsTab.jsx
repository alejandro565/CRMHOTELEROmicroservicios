import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api.client';
import ENDPOINTS from '../../../config/api.config';
import { Card, CardBody, Input, Button, Spinner } from '../../../components/ui';
import toast from 'react-hot-toast';
import { Bed, Plus, Trash2, Check } from 'lucide-react';

export default function BedsTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: bedTypes, isLoading } = useQuery({
    queryKey: ['bed-types'],
    queryFn: () => api.get(ENDPOINTS.hotels.beds()).then(r => r.data || [])
  });

  const createBed = useMutation({
    mutationFn: (data) => api.post(ENDPOINTS.hotels.beds(), data),
    onSuccess: () => { 
      toast.success('Tipo de cama creada'); 
      queryClient.invalidateQueries(['bed-types']); 
      setShowForm(false);
    }
  });

  const deleteBed = useMutation({
    mutationFn: (id) => api.delete(`${ENDPOINTS.hotels.beds()}/${id}`),
    onSuccess: () => { toast.success('Cama eliminada'); queryClient.invalidateQueries(['bed-types']); }
  });

  const handleAdd = (e) => {
    e.preventDefault();
    const data = { name: e.target.name.value, description: e.target.description.value };
    createBed.mutate(data);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-bold text-surface-800">Tipos de Camas ({bedTypes?.length || 0})</h3>
        <Button variant={showForm ? 'ghost' : 'secondary'} size="sm" icon={showForm ? null : <Plus size={16} />} onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancelar' : 'Nuevo'}
        </Button>
      </div>

      {showForm && (
        <Card className="border-indigo-200 bg-indigo-50/30 animate-scale-in">
          <CardBody className="p-6">
            <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4 items-stretch md:items-end">
              <div className="flex-1 min-w-0"><Input label="Nombre de Cama" name="name" placeholder="Ej: King Size" required /></div>
              <div className="flex-[2] min-w-0"><Input label="Descripción (opcional)" name="description" placeholder="Ej: 2x2 metros" /></div>
              <div className="shrink-0 pb-1 flex justify-end">
                <Button type="submit" variant="primary" loading={createBed.isPending} icon={<Check size={16} />}>Crear</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {isLoading ? <Spinner /> :
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {bedTypes?.map(b => (
            <Card key={b.id} hoverEffect className="group">
              <CardBody className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Bed size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-surface-900">{b.name}</p>
                  </div>
                </div>
                <button 
                   onClick={() => deleteBed.mutate(b.id)}
                   className="p-2 text-surface-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                >
                  <Trash2 size={16} />
                </button>
              </CardBody>
            </Card>
          ))}
          {bedTypes?.length === 0 && !showForm && <p className="col-span-2 text-center text-surface-400 py-10 italic">No hay tipos de cama registrados</p>}
        </div>
      }
    </div>
  );
}
