import React from 'react';
import { Server } from 'lucide-react';

export default function ServiceCard({ svcKey, svcInfo, isSelected, onClick }) {
  const isOnline = svcInfo && !svcInfo.error && svcInfo.data;

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-2xl border p-5 shadow-sm space-y-4 transition-all ${
        isSelected 
          ? 'border-brand-500 bg-brand-50/20 ring-1 ring-brand-500' 
          : 'border-surface-200 bg-white hover:border-surface-300'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isOnline ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'
          }`}>
            <Server size={20} />
          </div>
          <div>
            <h3 className="font-bold text-surface-900">{svcKey}-service</h3>
            <p className="text-xs text-surface-400">
              Puerto: {isOnline ? svcInfo.data.port : '--'}
            </p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
          !svcInfo ? 'bg-surface-50 text-surface-600 animate-pulse' : isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            !svcInfo ? 'bg-surface-400 animate-pulse' : isOnline ? 'bg-emerald-600' : 'bg-red-600'
          }`}></span>
          {!svcInfo ? 'Cargando' : isOnline ? 'Online' : 'Offline'}
        </span>
      </div>

      {isOnline && (
        <div className="text-xs text-surface-500 space-y-1.5 pt-2 border-t border-surface-100/50">
          <div className="flex justify-between">
            <span>Base de datos:</span>
            <span className="font-semibold text-surface-700">{svcInfo.data.database || 'Ninguna'}</span>
          </div>
          <div className="flex justify-between">
            <span>Memoria:</span>
            <span className="font-semibold text-surface-700">{svcInfo.data.health?.memory_mb} MB</span>
          </div>
        </div>
      )}

      {svcInfo?.error && (
        <p className="text-[11px] text-red-500 bg-red-50/50 border border-red-100 p-2 rounded-lg truncate">
          {svcInfo.error}
        </p>
      )}
    </div>
  );
}
