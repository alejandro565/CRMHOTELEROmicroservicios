import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api.client';
import ENDPOINTS from '../../../config/api.config';
import { Card, CardBody, Input, Button, Spinner } from '../../../components/ui';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';

export default function RoomsTab() {
  const queryClient = useQueryClient();
  const [showMassForm, setShowMassForm] = useState(false);

  const { data: roomTypes } = useQuery({
    queryKey: ['room-types'],
    queryFn: () => api.get(ENDPOINTS.hotels.listRoomTypes()).then(r => r.data || [])
  });

  const { data: rooms, isLoading } = useQuery({
    queryKey: ['rooms-list'],
    queryFn: () => api.get(ENDPOINTS.hotels.listRooms()).then(r => r.data || [])
  });

  const massCreateRooms = useMutation({
    mutationFn: (data) => api.post(ENDPOINTS.hotels.massCreateRooms(), data),
    onSuccess: () => { 
      toast.success('Habitaciones generadas'); 
      queryClient.invalidateQueries(['rooms-list']);
      setShowMassForm(false);
    },
    onError: (err) => toast.error(err.message || 'Error al generar')
  });

  const deleteRoom = useMutation({
    mutationFn: (id) => api.delete(ENDPOINTS.hotels.deleteRoom(id)),
    onSuccess: () => {
      toast.success('Eliminado correctamente');
      queryClient.invalidateQueries(['rooms-list']);
    },
    onError: (err) => toast.error(err.message || 'Error al eliminar')
  });

  const handleMassCreate = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      prefix: formData.get('prefix') || '',
      start: parseInt(formData.get('start')),
      count: parseInt(formData.get('count')),
      room_type_id: formData.get('room_type_id')
    };
    massCreateRooms.mutate(data);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-bold text-surface-800">Inventario de Habitaciones ({rooms?.length || 0})</h3>
        <Button variant={showMassForm ? 'ghost' : 'secondary'} size="sm" icon={showMassForm ? null : <Plus size={16} />} onClick={() => setShowMassForm(!showMassForm)}>
            {showMassForm ? 'Cancelar' : 'Generar Masivo'}
        </Button>
      </div>

      {showMassForm && (
        <Card className="border-brand-200 bg-brand-50/20 animate-scale-in">
          <CardBody className="p-6">
            <form onSubmit={handleMassCreate} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
              <div className="w-full"><Input label="Prefijo" name="prefix" placeholder="Ej: 1" /></div>
              <div className="w-full"><Input label="Inicio" name="start" type="number" defaultValue="1" required /></div>
              <div className="w-full"><Input label="Cantidad" name="count" type="number" defaultValue="10" required /></div>
              <div className="w-full">
                <label className="text-[10px] font-bold text-surface-500 uppercase mb-1 block">Categoría</label>
                <select name="room_type_id" required className="w-full bg-white border border-surface-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-500">
                  {roomTypes ? roomTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name}</option>) : <option>Cargando...</option>}
                </select>
              </div>
              <div className="sm:col-span-4 flex justify-end">
                <Button type="submit" variant="primary" loading={massCreateRooms.isPending}>Generar Habitaciones</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {isLoading ? <Spinner /> :
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {rooms?.map(r => (
            <div key={r.id} className="group relative bg-white border border-surface-200 p-4 rounded-2xl hover:border-brand-300 transition-all text-center">
              <span className="block text-xl font-bold text-surface-900 mb-1">{r.number}</span>
              <span className="text-[10px] uppercase font-bold text-surface-400">{r.room_type_name || 'Sin tipo'}</span>
              <button 
                onClick={() => deleteRoom.mutate(r.id)}
                className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 cursor-pointer"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {rooms?.length === 0 && !showMassForm && <p className="col-span-full text-center text-surface-400 py-10 italic">No hay habitaciones físicas registradas</p>}
        </div>
      }
    </div>
  );
}
