import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api.client';
import ENDPOINTS from '../../../config/api.config';
import { Card, CardHeader, CardBody, Input, Button, Spinner } from '../../../components/ui';
import toast from 'react-hot-toast';
import { Settings2, Clock, Coins, Save, Hotel } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';

export default function GeneralTab() {
  const { user, refreshPendingSelection } = useAuth();
  const queryClient = useQueryClient();

  const { data: tenant, isLoading: loadingTenant } = useQuery({
    queryKey: ['tenant-details', user?.tenant_id],
    queryFn: () => api.get(ENDPOINTS.saas.getTenant(user.tenant_id)).then(r => r.data),
    enabled: !!user?.tenant_id
  });

  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ['hotel-settings'],
    queryFn: () => api.get(ENDPOINTS.hotels.getSettings()).then(r => r.data)
  });

  const updateAll = useMutation({
    mutationFn: async (formData) => {
      const { hotel_name, ...settingsData } = formData;
      const promises = [
        api.put(ENDPOINTS.hotels.updateSettings(), settingsData)
      ];
      if (hotel_name && hotel_name !== tenant?.name) {
        promises.push(api.patch(ENDPOINTS.saas.updateTenant(user.tenant_id), { name: hotel_name }));
      }
      return Promise.all(promises);
    },
    onSuccess: () => {
      toast.success('Configuración actualizada');
      queryClient.invalidateQueries(['hotel-settings']);
      queryClient.invalidateQueries(['tenant-details']);
      refreshPendingSelection();
    },
    onError: (err) => toast.error(err.message || 'Error al actualizar')
  });

  const handleSave = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    updateAll.mutate(data);
  };

  if (loadingSettings || loadingTenant) return <div className="flex justify-center p-12"><Spinner /></div>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 p-6 border-b border-surface-100">
        <Settings2 className="text-brand-500" size={20} />
        <h3 className="font-heading font-bold text-surface-900">Perfil y Horarios</h3>
      </CardHeader>
      <CardBody className="p-8">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <Input 
                label="Nombre Comercial del Hotel" name="hotel_name"
                defaultValue={tenant?.name || ''}
                placeholder="Ej: Gran Hotel Plaza"
                icon={<Hotel size={16} />}
                required
              />
            </div>
            <Input 
              label="Zona Horaria" name="timezone"
              defaultValue={settings?.timezone || 'America/La_Paz'}
              placeholder="Ej: America/La_Paz"
              icon={<Clock size={16} />}
            />
            <Input 
              label="Moneda Principal" name="currency"
              defaultValue={settings?.currency || 'BOB'}
              placeholder="Ej: BOB, USD"
              icon={<Coins size={16} />}
            />
            <Input 
              label="Hora Check-in" name="checkin_time" type="time"
              defaultValue={settings?.checkin_time || '14:00'}
            />
            <Input 
              label="Hora Check-out" name="checkout_time" type="time"
              defaultValue={settings?.checkout_time || '12:00'}
            />
          </div>
          <div className="flex justify-end pt-4">
            <Button type="submit" variant="primary" loading={updateAll.status === 'pending'} icon={<Save size={18} />}>
              Guardar Cambios
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
