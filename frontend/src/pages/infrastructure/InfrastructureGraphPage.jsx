import React, { useEffect, useState } from 'react';
import { api } from '../../services/api.client';
import ENDPOINTS from '../../config/api.config';
import { Network, Activity, Cpu, ShieldCheck } from 'lucide-react';
import ServiceCard from './components/ServiceCard';
import ServiceDetailPanel from './components/ServiceDetailPanel';

const SERVICES_TO_DISCOVER = [
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
  const [selectedService, setSelectedService] = useState('saas');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAllDiscoveries = async () => {
    setLoading(true);
    setError(null);
    const updatedData = {};

    try {
      await Promise.all(
        SERVICES_TO_DISCOVER.map(async (svcKey) => {
          try {
            const res = await api.get(ENDPOINTS.infrastructure.discovery(svcKey));
            updatedData[svcKey] = { data: res, error: null };
          } catch (err) {
            updatedData[svcKey] = { 
              data: null, 
              error: err.message || `No se pudo conectar a ${svcKey}-service` 
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
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-200 pb-5">
        <div>
          <h1 className="text-2xl font-heading font-bold text-surface-900 flex items-center gap-2">
            <Network className="text-brand-500" /> Monitoreo de Infraestructura
          </h1>
          <p className="text-sm text-surface-500 mt-1">
            Autodescubrimiento dinámico de microservicios y mapeo de seguridad.
          </p>
        </div>
        <button
          onClick={fetchAllDiscoveries}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          <Activity size={16} /> Actualizar Todo
        </button>
      </div>

      {/* Servicios Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {SERVICES_TO_DISCOVER.map((svcKey) => (
          <ServiceCard
            key={svcKey}
            svcKey={svcKey}
            svcInfo={servicesData[svcKey]}
            isSelected={selectedService === svcKey}
            onClick={() => setSelectedService(svcKey)}
          />
        ))}

        {/* Panel de ciberseguridad global */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl p-5 shadow-md space-y-3 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none translate-x-1/4 translate-y-1/4">
            <Cpu size={140} />
          </div>
          <div>
            <h3 className="font-heading font-bold text-base flex items-center gap-2 text-brand-400">
              <ShieldCheck size={18} /> Resiliencia y Defensa
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mt-1">
              Selecciona un servicio a la izquierda para inspeccionar sus llamadas, dependencias y topología de red dinámica.
            </p>
          </div>
          <div className="text-[11px] text-slate-400 bg-white/5 border border-white/5 rounded-lg p-2.5 mt-2">
            Tip de Seguridad: Compara las dependencias declaradas con el tráfico en tiempo real para detectar intrusiones laterales.
          </div>
        </div>
      </div>

      {/* Detalle del servicio seleccionado */}
      <ServiceDetailPanel
        selectedService={selectedService}
        activeData={activeInfo?.data}
        activeError={activeInfo?.error}
        loading={loading}
      />
    </div>
  );
}
