import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api.client';
import ENDPOINTS from '../../../config/api.config';
import { Card, CardBody, Input, Button, Spinner, Select } from '../../../components/ui';
import toast from 'react-hot-toast';
import { Package, Plus, Trash2, Check, RefreshCw, AlertTriangle, X } from 'lucide-react';

export default function LendableItemsTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [adjustingId, setAdjustingId] = useState(null);
  const [adjustQty, setAdjustQty] = useState(1);

  const { data: items, isLoading } = useQuery({
    queryKey: ['lendable-items'],
    queryFn: () => api.get(ENDPOINTS.hotels.listItems()).then(r => r.data || [])
  });

  const createItem = useMutation({
    mutationFn: (data) => api.post(ENDPOINTS.hotels.createItem(), data),
    onSuccess: () => { 
      toast.success('Artículo creado'); 
      queryClient.invalidateQueries(['lendable-items']); 
      setShowForm(false);
    },
    onError: (err) => toast.error(err.message)
  });

  const deleteItem = useMutation({
    mutationFn: (id) => api.delete(`${ENDPOINTS.hotels.listItems()}/${id}`),
    onSuccess: () => { 
      toast.success('Artículo eliminado'); 
      queryClient.invalidateQueries(['lendable-items']); 
    }
  });

  const adjustInventory = useMutation({
    mutationFn: ({ itemId, qty, reason }) => api.patch(ENDPOINTS.hotels.adjustInventory(itemId), { qty, reason }),
    onSuccess: () => {
      toast.success('Inventario ajustado');
      queryClient.invalidateQueries(['lendable-items']);
      setAdjustingId(null);
    },
    onError: (err) => toast.error(err.message)
  });

  const handleAdd = (e) => {
    e.preventDefault();
    const data = { 
      name: e.target.name.value, 
      description: e.target.description.value,
      replacement_cost: parseFloat(e.target.cost.value || 0)
    };
    createItem.mutate(data);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <div className="flex flex-col">
          <h3 className="text-lg font-bold text-surface-800 tracking-tight leading-none">Objetos Prestables ({items?.length || 0})</h3>
          <p className="text-xs text-surface-400 mt-1">Gestione el inventario de llaves, controles, mantas y otros objetos.</p>
        </div>
        <Button variant={showForm ? 'ghost' : 'primary'} size="sm" icon={showForm ? null : <Plus size={16} />} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancelar' : 'Nuevo Objeto'}
        </Button>
      </div>

      {showForm && (
        <Card className="border-brand-200 bg-brand-50/30 animate-scale-in overflow-visible">
          <CardBody className="p-6">
            <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="md:col-span-1">
                <Input label="Nombre *" name="name" required placeholder="Ej: Llave de Habitación" />
              </div>
              <div className="md:col-span-2">
                <Input label="Descripción" name="description" placeholder="Ej: Llave maestra para habitación simple" />
              </div>
              <div className="md:col-span-1">
                <Input label="Costo Reposición (Bs) *" name="cost" type="number" step="0.01" required defaultValue="50.00" />
              </div>
              <div className="md:col-span-4 flex justify-end">
                <Button type="submit" variant="primary" loading={createItem.isPending} icon={<Check size={16} />}>
                  Registrar Objeto
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size={32} /></div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {items?.map(item => (
            <Card key={item.id} className="group relative overflow-hidden transition-all hover:shadow-md border-surface-200">
              <CardBody className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                    item.inventory?.available_qty > 0 ? 'bg-brand-50 text-brand-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                    <Package size={24} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-surface-900">{item.name}</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                        Bs {item.replacement_cost} reposición
                      </span>
                    </div>
                    <p className="text-xs text-surface-500 line-clamp-1">{item.description || 'Sin descripción'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6 pr-4">
                   <div className="text-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Disponibles</p>
                      <p className={`text-lg font-black leading-none mt-1 ${
                        item.inventory?.available_qty <= item.inventory?.low_stock_threshold ? 'text-amber-500' : 'text-slate-800'
                      }`}>
                        {item.inventory?.available_qty} / {item.inventory?.total_qty}
                      </p>
                   </div>

                   <div className="flex items-center gap-1">
                      {adjustingId === item.id ? (
                        <div className="flex items-center gap-1 animate-fade-in">
                          <Input 
                            type="number" 
                            className="w-16 !h-8 text-center" 
                            value={adjustQty} 
                            onChange={e => setAdjustQty(parseInt(e.target.value || 0))} 
                          />
                          <Button 
                            size="sm" 
                            variant="success" 
                            className="h-8 w-8 !p-0"
                            onClick={() => adjustInventory.mutate({ itemId: item.id, qty: adjustQty, reason: 'PURCHASE' })}
                            loading={adjustInventory.isPending}
                          >
                            <Check size={14} />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 w-8 !p-0"
                            onClick={() => setAdjustingId(null)}
                          >
                            <X size={14} />
                          </Button>
                        </div>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          className="h-8 px-2"
                          onClick={() => { setAdjustingId(item.id); setAdjustQty(1); }}
                        >
                          <RefreshCw size={14} className="mr-1" /> Ajustar
                        </Button>
                      )}
                      
                      <button 
                        onClick={() => deleteItem.mutate(item.id)}
                        className="p-2 text-surface-300 hover:text-red-500 transition-colors"
                        title="Eliminar del catálogo"
                      >
                        <Trash2 size={16} />
                      </button>
                   </div>
                </div>

                {item.inventory?.available_qty <= item.inventory?.low_stock_threshold && (
                  <div className="absolute top-0 right-0 p-1">
                    <AlertTriangle size={14} className="text-amber-500" />
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
          
          {items?.length === 0 && !showForm && (
            <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
               <Package size={40} className="mx-auto text-slate-300 mb-4" />
               <p className="text-sm font-bold text-slate-400">No hay objetos registrados en el catálogo</p>
               <p className="text-xs text-slate-300 mt-1">Comience agregando llaves o artículos que entregue a sus huéspedes.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
