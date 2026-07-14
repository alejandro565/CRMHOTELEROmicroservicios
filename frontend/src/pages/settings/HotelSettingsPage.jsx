import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api.client';
import ENDPOINTS from '../../config/api.config';
import { Card, CardBody, Button, PageHeader } from '../../components/ui';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { hasAnyPermission } from '../../config/access';
import { 
  Building2, 
  Coffee, 
  Bed, 
  Home, 
  DoorOpen,
  Sparkles,
  RefreshCcw,
  Banknote,
  Package,
  Users,
  Shield
} from 'lucide-react';

import GeneralTab from './components/GeneralTab';
import AmenitiesTab from './components/AmenitiesTab';
import BedsTab from './components/BedsTab';
import RoomTypesTab from './components/RoomTypesTab';
import RoomsTab from './components/RoomsTab';
import ExchangeRatesTab from './components/ExchangeRatesTab';
import LendableItemsTab from './components/LendableItemsTab';
import UsersTab from './components/UsersTab';
import RolesTab from './components/RolesTab';

export default function HotelSettingsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('general');
  const canConfigureHotel = hasAnyPermission(user, ['HOTELS_CONFIG']);

  // We only fetch these at the top level to conditionally show the seeder button
  const { data: roomTypes, isLoading: loadingRoomTypes } = useQuery({
    queryKey: ['room-types'],
    queryFn: () => api.get(ENDPOINTS.hotels.listRoomTypes()).then(r => r.data || []),
    enabled: canConfigureHotel,
  });

  const { data: rooms, isLoading: loadingRooms } = useQuery({
    queryKey: ['rooms-list'],
    queryFn: () => api.get(ENDPOINTS.hotels.listRooms()).then(r => r.data || []),
    enabled: canConfigureHotel,
  });

  const runSeeder = useMutation({
    mutationFn: () => api.post(ENDPOINTS.hotels.onboardingSeed()),
    onSuccess: () => {
      toast.success('¡Hotel poblado con datos de ejemplo!');
      queryClient.invalidateQueries();
    },
    onError: (err) => toast.error(err.message || 'Error al ejecutar seeder')
  });

  // Seeder logic simplified - only show if everything is totally empty
  const showSeeder = canConfigureHotel && !loadingRoomTypes && !loadingRooms && (roomTypes?.length === 0 && rooms?.length === 0);

  const TABS = [
    { id: 'general', icon: <Building2 size={16} />, label: 'General', permissions: ['HOTELS_CONFIG'], component: <GeneralTab /> },
    { id: 'users', icon: <Users size={16} />, label: 'Personal', permissions: ['USERS_VIEW', 'USERS_MANAGE'], component: <UsersTab /> },
    { id: 'roles', icon: <Shield size={16} />, label: 'Roles', permissions: ['ROLES_MANAGE', 'USERS_ROLES'], component: <RolesTab /> },
    { id: 'exchange', icon: <Banknote size={16} />, label: 'Tasas de Cambio', permissions: ['EXCHANGE_MANAGE'], component: <ExchangeRatesTab /> },
    { id: 'amenities', icon: <Coffee size={16} />, label: 'Amenidades', permissions: ['HOTELS_CONFIG'], component: <AmenitiesTab /> },
    { id: 'beds', icon: <Bed size={16} />, label: 'Camas', permissions: ['HOTELS_CONFIG'], component: <BedsTab /> },
    { id: 'items', icon: <Package size={16} />, label: 'Objetos', permissions: ['INVENTORY_MANAGE'], component: <LendableItemsTab /> },
    { id: 'room-types', icon: <Home size={16} />, label: 'Tipos', permissions: ['HOTELS_CONFIG'], component: <RoomTypesTab /> },
    { id: 'rooms', icon: <DoorOpen size={16} />, label: 'Habitaciones', permissions: ['HOTELS_CONFIG'], component: <RoomsTab /> },
  ];

  const visibleTabs = TABS.filter(tab => hasAnyPermission(user, tab.permissions));

  useEffect(() => {
    if (visibleTabs.length && !visibleTabs.some(tab => tab.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [activeTab, visibleTabs]);

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <PageHeader
        title="Configuración del Hotel"
        subtitle="Gestiona el perfil, horarios, cobros y la infraestructura física de tu propiedad."
      />

      {/* Tabs Navigation */}
      <div className="flex gap-2 p-1 bg-surface-100 rounded-2xl w-fit overflow-x-auto max-w-full custom-scrollbar">
        {visibleTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === tab.id 
                ? 'bg-white text-brand-600 shadow-sm border border-surface-200/50' 
                : 'text-surface-500 hover:text-surface-700 hover:bg-white/50'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          {visibleTabs.find(t => t.id === activeTab)?.component}
        </div>

        {/* Sidebar Actions */}
        <div className="space-y-6">
          {showSeeder && (
            <Card className="bg-gradient-to-br from-brand-600 to-indigo-700 border-none text-white shadow-xl shadow-brand-500/20 animate-fade-in relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
              <CardBody className="p-8 relative z-10">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-6">
                  <Sparkles className="text-white" />
                </div>
                <h3 className="text-xl font-heading font-bold mb-3">Puesta en marcha</h3>
                <p className="text-white/80 text-sm leading-relaxed mb-6">
                  ¿Quieres ahorrar tiempo? Presiona el botón para configurar automáticamente amenidades, camas y tipos de habitación base.
                </p>
                <Button 
                  variant="white" 
                  fullWidth 
                  icon={<RefreshCcw size={18} />}
                  onClick={() => runSeeder.mutate()}
                  loading={runSeeder.status === 'pending'}
                  className="font-bold text-brand-700 hover:bg-white/90"
                >
                  Cargar Datos Demo
                </Button>
              </CardBody>
            </Card>
          )}

          <div className="bg-brand-50 border border-brand-100 p-6 rounded-2xl">
            <h4 className="font-bold text-brand-800 text-sm mb-2">Instrucciones Rápidas</h4>
            <ul className="text-xs text-brand-700 space-y-2 list-disc pl-4">
                <li>Registra a tu <strong>Personal</strong> y asígnales un <strong>Rol</strong>.</li>
                <li>Configura tus <strong>Tasas de Cambio</strong> para recibir pagos multimoneda.</li>
                <li>Define tus <strong>Amenidades</strong> y <strong>Camas</strong> base.</li>
                <li>Registra <strong>Objetos</strong> (llaves, controles) para control de inventario.</li>
                <li>Genera tu inventario real de <strong>Habitaciones</strong>.</li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
}
