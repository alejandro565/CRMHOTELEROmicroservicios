import React from 'react';

export default function ServiceDetailPanel({ selectedService, activeData, activeError, loading }) {
  return (
    <div className="bg-white rounded-3xl border border-surface-200 overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-surface-100 bg-surface-50 flex items-center justify-between">
        <h2 className="font-bold text-surface-900 text-sm">
          Detalle del Servicio: <span className="text-brand-600">{selectedService}-service</span>
        </h2>
        <span className="text-xs text-surface-400 font-mono">
          GET /{selectedService}/internal/discovery
        </span>
      </div>
      <div className="p-5">
        {loading ? (
          <div className="h-60 flex flex-col items-center justify-center space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
            <p className="text-xs text-surface-400">Descubriendo infraestructura...</p>
          </div>
        ) : activeError ? (
          <div className="h-60 flex flex-col items-center justify-center space-y-2 text-red-500">
            <p className="font-bold text-sm">Fallo de Comunicación con el Servicio:</p>
            <p className="text-xs font-mono bg-red-50 border border-red-100 rounded-lg p-3 max-w-lg text-center">
              {activeError}
            </p>
          </div>
        ) : activeData ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Rutas */}
              <div className="border border-surface-100 rounded-xl p-4 bg-surface-50/50 md:col-span-2">
                <h4 className="font-bold text-surface-800 text-xs mb-3 uppercase tracking-wider">
                  Rutas de API Registradas ({activeData.routes?.length || 0})
                </h4>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {activeData.routes?.map((route, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white border border-surface-100 rounded-lg p-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded font-bold font-mono text-[10px] ${
                          route.methods.includes('GET') ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {route.methods.join(',')}
                        </span>
                        <span className="font-mono text-surface-600">{route.path}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        route.type === 'internal' ? 'bg-purple-50 text-purple-700' : 'bg-surface-100 text-surface-600'
                      }`}>
                        {route.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Eventos y Dependencias */}
              <div className="space-y-6">
                {/* Dependencias de Red */}
                <div className="border border-surface-100 rounded-xl p-4 bg-surface-50/50">
                  <h4 className="font-bold text-surface-800 text-xs mb-3 uppercase tracking-wider">
                    Dependencias HTTP Síncronas
                  </h4>
                  {activeData.dependencies?.length > 0 ? (
                    <div className="space-y-2">
                      {activeData.dependencies.map((dep, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-surface-600 bg-white border border-surface-100 p-2 rounded-lg">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-500"></span>
                          <span>{dep}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-surface-400 italic">No tiene dependencias directas salientes.</p>
                  )}
                </div>

                {/* Eventos RabbitMQ */}
                <div className="border border-surface-100 rounded-xl p-4 bg-surface-50/50">
                  <h4 className="font-bold text-surface-800 text-xs mb-3 uppercase tracking-wider">
                    Mensajería (RabbitMQ)
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <span className="text-[10px] font-bold text-surface-400 uppercase tracking-widest block mb-1">Publica</span>
                      {activeData.events?.publishes?.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {activeData.events.publishes.map((e, idx) => (
                            <span key={idx} className="bg-amber-50 text-amber-800 border border-amber-100 px-2 py-0.5 rounded text-[11px] font-mono">
                              {e}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-surface-400 italic">No publica eventos.</span>
                      )}
                    </div>
                    <div className="pt-2 border-t border-surface-100">
                      <span className="text-[10px] font-bold text-surface-400 uppercase tracking-widest block mb-1">Consume</span>
                      {activeData.events?.consumes?.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {activeData.events.consumes.map((e, idx) => (
                            <span key={idx} className="bg-indigo-50 text-indigo-800 border border-indigo-100 px-2 py-0.5 rounded text-[11px] font-mono">
                              {e}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-surface-400 italic">No consume eventos.</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Raw JSON */}
            <details className="group border border-surface-100 rounded-xl overflow-hidden">
              <summary className="px-4 py-3 bg-surface-50 hover:bg-surface-100/50 cursor-pointer font-bold text-xs text-surface-700 select-none flex justify-between items-center">
                <span>Ver Payload JSON Completo</span>
                <span className="text-surface-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <pre className="bg-surface-950 text-emerald-400 p-4 text-xs font-mono overflow-x-auto max-h-80">
                {JSON.stringify(activeData, null, 2)}
              </pre>
            </details>
          </div>
        ) : (
          <div className="h-60 flex items-center justify-center text-xs text-surface-400">
            No hay datos disponibles.
          </div>
        )}
      </div>
    </div>
  );
}
