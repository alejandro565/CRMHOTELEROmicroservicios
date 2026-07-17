import React, { useEffect, useState } from 'react';
import { api } from '../../services/api.client';
import ENDPOINTS from '../../config/api.config';
import { Network, Activity, Cpu, ShieldCheck } from 'lucide-react';
import ServiceCard from './components/ServiceCard';
import ServiceGraph from './components/ServiceGraph';
import ServiceDetailPanel from './components/ServiceDetailPanel';

const FRONTEND_STATIC_DATA = {
  service: 'frontend',
  version: 'spa',
  port: 'browser',
  database: null,
  routes: [
    { methods: ['GET'], path: '/', type: 'public', handler: 'AppShell.render' },
    { methods: ['GET'], path: '/infrastructure', type: 'public', handler: 'InfrastructureGraphPage.render' },
  ],
  events: {
    publishes: [],
    consumes: [],
  },
  dependencies: [
    'saas-service',
    'auth-service',
    'hotels-service',
    'guest-service',
    'reservation-service',
    'billing-service',
    'audit-service',
    'reporting-service',
  ],
  health: {
    status: 'ok',
    uptime_s: 0,
    memory_mb: 0,
  },
  discovered_at: new Date().toISOString(),
};

const SERVICES_TO_DISCOVER = [
  'frontend',
  'saas',
  'auth',
  'hotels',
  'guest',
  'reservation',
  'billing',
  'audit',
  'reporting',
];

export default function InfrastructureGraphPage() {
  const [servicesData, setServicesData] = useState({});
  const [selectedService, setSelectedService] = useState('frontend');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAllDiscoveries = async () => {
    setLoading(true);
    setError(null);
    const updatedData = {
      frontend: { data: FRONTEND_STATIC_DATA, error: null },
    };

    try {
      await Promise.all(
        SERVICES_TO_DISCOVER.filter((svcKey) => svcKey !== 'frontend').map(async (svcKey) => {
          try {
            const res = await api.get(ENDPOINTS.infrastructure.discovery(svcKey));
            updatedData[svcKey] = { data: res, error: null };
          } catch (err) {
            updatedData[svcKey] = {
              data: null,
              error: err.message || `No se pudo conectar a ${svcKey}-service`,
            };
          }
        })
      );
      setServicesData(updatedData);
    } catch (globalErr) {
      setError('Error al procesar el descubrimiento de servicios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllDiscoveries();
  }, []);

  const activeInfo = servicesData[selectedService];

  return (
    <div className="p-6 max-w-[1800px] mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-surface-200 pb-5 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 flex items-center gap-2">
            <Network className="text-brand-500" /> Monitoreo de Infraestructura
          </h1>
          <p className="text-sm text-surface-500 mt-1">
            Grafo principal de servicios, conexiones y rutas del ecosistema hotelero.
          </p>
        </div>
        <button
          onClick={fetchAllDiscoveries}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          <Activity size={16} /> Actualizar Todo
        </button>
      </div>

      <div className="space-y-6">
        <ServiceGraph
          servicesData={servicesData}
          selectedService={selectedService}
          onSelect={setSelectedService}
        />

        <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
          <ServiceDetailPanel
            selectedService={selectedService}
            activeData={activeInfo?.data}
            activeError={activeInfo?.error}
            loading={loading}
          />

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SERVICES_TO_DISCOVER.map((svcKey) => (
                <ServiceCard
                  key={svcKey}
                  svcKey={svcKey}
                  svcInfo={servicesData[svcKey]}
                  isSelected={selectedService === svcKey}
                  onClick={() => setSelectedService(svcKey)}
                />
              ))}
            </div>

            <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl p-5 shadow-md space-y-3 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none translate-x-1/4 translate-y-1/4">
                <Cpu size={140} />
              </div>
              <div>
                <h3 className="font-heading font-bold text-base flex items-center gap-2 text-brand-400">
                  <ShieldCheck size={18} /> Resiliencia y Defensa
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed mt-1">
                  Haz clic en cualquier nodo para ver sus rutas, conectividad y el nombre de cada relación del grafo.
                </p>
              </div>
              <div className="text-[11px] text-slate-400 bg-white/5 border border-white/5 rounded-lg p-2.5 mt-2">
                Tip de Seguridad: compara las dependencias declaradas con el tráfico en tiempo real para detectar intrusiones laterales.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
