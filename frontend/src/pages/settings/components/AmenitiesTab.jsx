import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api.client';
import ENDPOINTS from '../../../config/api.config';
import { Card, CardBody, Input, Button, Spinner } from '../../../components/ui';
import toast from 'react-hot-toast';
import { Coffee, Plus, Trash2, Check } from 'lucide-react';

export default function AmenitiesTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: amenities, isLoading } = useQuery({
    queryKey: ['amenities'],
    queryFn: () => api.get(ENDPOINTS.hotels.amenities()).then(r => r.data || [])
  });

  const createAmenity = useMutation({
    mutationFn: (data) => api.post(ENDPOINTS.hotels.amenities(), data),
    onSuccess: () => { 
      toast.success('Amenidad creada'); 
      queryClient.invalidateQueries(['amenities']); 
      setShowForm(false);
    }
  });

  const deleteAmenity = useMutation({
    mutationFn: (id) => api.delete(`${ENDPOINTS.hotels.amenities()}/${id}`),
    onSuccess: () => { toast.success('Amenidad eliminada'); queryClient.invalidateQueries(['amenities']); }
  });

  const handleAdd = (e) => {
    e.preventDefault();
    const data = { name: e.target.name.value, description: e.target.description.value };
    createAmenity.mutate(data);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-bold text-surface-800">Catálogo de Amenidades ({amenities?.length || 0})</h3>
        <Button variant={showForm ? 'ghost' : 'secondary'} size="sm" icon={showForm ? null : <Plus size={16} />} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancelar' : 'Nueva'}
        </Button>
      </div>

      {showForm && (
        <Card className="border-brand-200 bg-brand-50/30 animate-scale-in">
          <CardBody className="p-6">
            <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4 items-stretch md:items-end">
              <div className="flex-1 min-w-0"><Input label="Nombre de amenidad" name="name" required placeholder="Ej: Aire Acondicionado" /></div>
              <div className="flex-[2] min-w-0"><Input label="Descripción (opcional)" name="description" placeholder="Ej: Split 12000 BTU" /></div>
              <div className="shrink-0 pb-1 flex justify-end">
                <Button type="submit" variant="primary" loading={createAmenity.isPending} icon={<Check size={16} />}>Crear</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {isLoading ? <Spinner /> : 
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {amenities?.map(a => (
            <Card key={a.id} hoverEffect className="group">
              <CardBody className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                    <Coffee size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-surface-900">{a.name}</p>
                  </div>
                </div>
                <button 
                  onClick={() => deleteAmenity.mutate(a.id)}
                  className="p-2 text-surface-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                >
                  <Trash2 size={16} />
                </button>
              </CardBody>
            </Card>
          ))}
          {amenities?.length === 0 && !showForm && <p className="col-span-2 text-center text-surface-400 py-10 italic">No hay amenidades registradas</p>}
        </div>
      }
    </div>
  );
}
