import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api.client';
import ENDPOINTS from '../../../config/api.config';
import { Card, CardBody, Input, Button, Spinner, Badge } from '../../../components/ui';
import toast from 'react-hot-toast';
import { Home, Plus, Trash2, Coins, Bed, Save } from 'lucide-react';

export default function RoomTypesTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingRoomType, setEditingRoomType] = useState(null);
  const [selectedAmenities, setSelectedAmenities] = useState([]);
  const [selectedBeds, setSelectedBeds] = useState([]);

  const { data: settings } = useQuery({
    queryKey: ['hotel-settings'],
    queryFn: () => api.get(ENDPOINTS.hotels.getSettings()).then(r => r.data)
  });

  const { data: amenities } = useQuery({
    queryKey: ['amenities'],
    queryFn: () => api.get(ENDPOINTS.hotels.amenities()).then(r => r.data || [])
  });

  const { data: bedTypes } = useQuery({
    queryKey: ['bed-types'],
    queryFn: () => api.get(ENDPOINTS.hotels.beds()).then(r => r.data || [])
  });

  const { data: roomTypes, isLoading } = useQuery({
    queryKey: ['room-types'],
    queryFn: () => api.get(ENDPOINTS.hotels.listRoomTypes()).then(r => r.data || [])
  });

  const createRoomTypeMut = useMutation({
    mutationFn: (data) => api.post(ENDPOINTS.hotels.createRoomType(), data),
    onSuccess: () => { 
      toast.success('Categoría creada'); 
      queryClient.invalidateQueries(['room-types']); 
      setShowForm(false);
      setSelectedAmenities([]);
      setSelectedBeds([]);
    },
    onError: (err) => toast.error(err.message || 'Error al crear categoría')
  });

  const updateRoomTypeMut = useMutation({
    mutationFn: ({ id, data }) => api.put(ENDPOINTS.hotels.updateRoomType(id), data),
    onSuccess: () => {
      toast.success('Categoría actualizada');
      queryClient.invalidateQueries(['room-types']);
      setShowForm(false);
      setEditingRoomType(null);
      setSelectedAmenities([]);
      setSelectedBeds([]);
    },
    onError: (err) => toast.error(err.message || 'Error al actualizar')
  });

  const deleteRoomType = useMutation({
    mutationFn: (id) => api.delete(ENDPOINTS.hotels.deleteRoomType(id)),
    onSuccess: () => {
      toast.success('Eliminado correctamente');
      queryClient.invalidateQueries(['room-types']);
    },
    onError: (err) => toast.error(err.message || 'Error al eliminar')
  });

  const handleSaveRoomType = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      name: formData.get('name'),
      description: formData.get('description'),
      base_price: parseFloat(formData.get('base_price')),
      bathroom_type: formData.get('bathroom_type'),
      max_capacity: parseInt(formData.get('max_capacity') || 2),
      amenity_ids: selectedAmenities,
      beds: selectedBeds.map(b => ({ bed_type_id: b.bed_type_id, count: b.count }))
    };

    if (editingRoomType) {
      updateRoomTypeMut.mutate({ id: editingRoomType.id, data });
    } else {
      createRoomTypeMut.mutate(data);
    }
  };

  const handleOpenEdit = (rt) => {
    setEditingRoomType(rt);
    setSelectedAmenities(rt.amenities?.map(a => a.id) || []);
    setSelectedBeds(rt.beds?.map(b => ({ bed_type_id: b.id, count: b.RoomTypeBed?.count || 1 })) || []);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingRoomType(null);
    setSelectedAmenities([]);
    setSelectedBeds([]);
  };

  const toggleAmenity = (id) => {
    setSelectedAmenities(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const updateBedCount = (bed_type_id, count) => {
    setSelectedBeds(prev => {
      const exists = prev.find(b => b.bed_type_id === bed_type_id);
      if (count <= 0) return prev.filter(b => b.bed_type_id !== bed_type_id);
      if (exists) return prev.map(b => b.bed_type_id === bed_type_id ? { ...b, count } : b);
      return [...prev, { bed_type_id, count }];
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-bold text-surface-800">Categorías de Habitación ({roomTypes?.length || 0})</h3>
        <Button variant={showForm ? 'ghost' : 'secondary'} size="sm" icon={showForm ? null : <Plus size={16} />} 
          onClick={() => {
            if (showForm) handleCloseForm();
            else setShowForm(true);
          }}>
            {showForm ? 'Cancelar' : 'Crear'}
        </Button>
      </div>

      {showForm && (
        <Card className="border-brand-200 bg-white shadow-xl animate-scale-in overflow-visible z-10">
          <CardBody className="p-8">
            <form onSubmit={handleSaveRoomType} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input label="Nombre de la Categoría" name="name" defaultValue={editingRoomType?.name} placeholder="Ej: Suite Deluxe" required />
                <Input label="Precio Base (por persona)" name="base_price" type="number" step="0.01" defaultValue={editingRoomType?.base_price} required icon={<Coins size={14}/>} />
                
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-surface-500 uppercase tracking-widest">Tipo de Baño</label>
                  <select name="bathroom_type" defaultValue={editingRoomType?.bathroom_type || 'PRIVATE'} className="w-full bg-surface-50 border border-surface-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-all font-medium text-sm">
                    <option value="PRIVATE">Privado</option>
                    <option value="SHARED">Compartido</option>
                  </select>
                </div>
                
                <Input label="Capacidad Máxima" name="max_capacity" type="number" defaultValue={editingRoomType?.max_capacity || 2} min="1" />
                
                <div className="md:col-span-2">
                    <Input label="Descripción Corta" name="description" defaultValue={editingRoomType?.description} placeholder="Ej: Habitación con vista al mar..." />
                </div>
              </div>

              {/* Selectors */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-surface-100">
                <div>
                  <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-3">Amenidades Disponibles</p>
                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {amenities?.map(a => (
                      <label key={a.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${selectedAmenities.includes(a.id) ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-white border-surface-100 text-surface-600 hover:border-surface-200'}`}>
                        <span className="text-sm font-semibold">{a.name}</span>
                        <input 
                          type="checkbox" 
                          className="accent-brand-500"
                          checked={selectedAmenities.includes(a.id)} 
                          onChange={() => toggleAmenity(a.id)} 
                        />
                      </label>
                    ))}
                    {amenities?.length === 0 && <p className="text-xs text-surface-400 italic">Crea amenidades primero</p>}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-3">Configuración de Camas</p>
                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {bedTypes?.map(b => {
                      const selected = selectedBeds.find(sb => sb.bed_type_id === b.id);
                      return (
                        <div key={b.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${selected ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-surface-100'}`}>
                          <span className="text-sm font-semibold text-surface-700">{b.name}</span>
                          <div className="flex items-center gap-2 bg-white rounded-lg border border-surface-200 p-1">
                            <button type="button" onClick={() => updateBedCount(b.id, (selected?.count || 0) - 1)} className="w-6 h-6 flex items-center justify-center hover:bg-surface-100 rounded text-surface-500">-</button>
                            <span className="w-6 text-center text-xs font-bold">{selected?.count || 0}</span>
                            <button type="button" onClick={() => updateBedCount(b.id, (selected?.count || 0) + 1)} className="w-6 h-6 flex items-center justify-center hover:bg-surface-100 rounded text-surface-500">+</button>
                          </div>
                        </div>
                      );
                    })}
                    {bedTypes?.length === 0 && <p className="text-xs text-surface-400 italic">Crea tipos de cama primero</p>}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-surface-100">
                <Button type="button" variant="ghost" onClick={handleCloseForm}>Descartar</Button>
                <Button type="submit" variant="primary" loading={createRoomTypeMut.isPending || updateRoomTypeMut.isPending} icon={<Save size={18} />}>
                  {editingRoomType ? 'Actualizar Categoría' : 'Guardar Categoría'}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {isLoading ? <Spinner /> :
        <div className="space-y-4">
          {roomTypes?.map(rt => (
            <Card key={rt.id} hoverEffect className="group relative">
              <CardBody className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-xl font-bold text-surface-900">{rt.name}</h4>
                    <p className="text-sm text-surface-500">{rt.description || 'Sin descripción'}</p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                    <p className="text-2xl font-black text-brand-600">{settings?.currency} {rt.base_price}</p>
                    <Badge variant="brand">{rt.bathroom_type === 'PRIVATE' ? 'Baño Privado' : 'Baño Compartido'}</Badge>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button 
                        onClick={() => handleOpenEdit(rt)}
                        className="p-2 text-surface-400 hover:text-brand-600 transition-all cursor-pointer"
                        title="Editar"
                      >
                        <Save size={18} />
                      </button>
                      <button 
                        onClick={() => deleteRoomType.mutate(rt.id)}
                        className="p-2 text-surface-300 hover:text-red-500 transition-all cursor-pointer"
                        title="Eliminar"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-2 border-t border-surface-100">
                  <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md uppercase flex items-center gap-1">
                    <Bed size={10}/> {rt.beds?.map(b => `${b.name} (x${b.RoomTypeBed.count})`).join(', ') || 'Sin camas'}
                  </span>
                  {rt.amenities?.map(a => (
                    <span key={a.id} className="text-[10px] font-bold bg-surface-100 text-surface-600 px-2 py-1 rounded-md uppercase">
                      {a.name}
                    </span>
                  ))}
                </div>
              </CardBody>
            </Card>
          ))}
          {roomTypes?.length === 0 && !showForm && <p className="text-center text-surface-400 py-10 italic">No hay categorías de habitación</p>}
        </div>
      }
    </div>
  );
}
