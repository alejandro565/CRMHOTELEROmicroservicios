import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api.client';
import ENDPOINTS from '../../../config/api.config';
import { Card, CardBody, Input, Button, Spinner, Table } from '../../../components/ui';
import toast from 'react-hot-toast';
import { Coins, Plus, Check } from 'lucide-react';

// Common currencies to offer in the dropdown
const COMMON_CURRENCIES = [
  { code: 'USD', name: 'Dólar Estadounidense' },
  { code: 'EUR', name: 'Euro' },
  { code: 'BRL', name: 'Real Brasileño' },
  { code: 'ARS', name: 'Peso Argentino' },
  { code: 'CLP', name: 'Peso Chileno' },
  { code: 'PEN', name: 'Sol Peruano' },
];

export default function ExchangeRatesTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [customCurrency, setCustomCurrency] = useState('');
  const [rateValue, setRateValue] = useState('');

  const { data: rates, isLoading } = useQuery({
    queryKey: ['exchange-rates'],
    queryFn: () => api.get(ENDPOINTS.billing.listRates()).then(r => r.data || [])
  });

  const { data: settings } = useQuery({
    queryKey: ['hotel-settings'],
    queryFn: () => api.get(ENDPOINTS.hotels.getSettings()).then(r => r.data)
  });

  const setRateMut = useMutation({
    mutationFn: (data) => api.post(ENDPOINTS.billing.setRate(), data),
    onSuccess: () => { 
      toast.success('Tasa de cambio actualizada'); 
      queryClient.invalidateQueries(['exchange-rates']); 
      setShowForm(false);
      setRateValue('');
    },
    onError: (err) => toast.error(err.message || 'Error al actualizar tasa')
  });

  const handleSaveRate = (e) => {
    e.preventDefault();
    const currency = selectedCurrency === 'OTHER' ? customCurrency.toUpperCase() : selectedCurrency;
    
    if (!currency || currency.length !== 3) {
      toast.error('El código de moneda debe tener 3 letras');
      return;
    }
    
    setRateMut.mutate({
      currency,
      rate: parseFloat(rateValue)
    });
  };

  const columns = [
    { key: 'currency', label: 'Moneda' },
    { key: 'rate', label: `Equivalencia en ${settings?.currency || 'BOB'}` },
    { key: 'updatedAt', label: 'Última Actualización', render: (val) => new Date(val).toLocaleString() }
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-bold text-surface-800">Tasas de Cambio</h3>
        <Button variant={showForm ? 'ghost' : 'secondary'} size="sm" icon={showForm ? null : <Plus size={16} />} onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancelar' : 'Añadir / Actualizar Tasa'}
        </Button>
      </div>

      {showForm && (
        <Card className="border-emerald-200 bg-emerald-50/30 animate-scale-in">
          <CardBody className="p-6">
            <form onSubmit={handleSaveRate} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
              <div className="w-full">
                <label className="text-[10px] font-bold text-surface-500 uppercase mb-1 block">Moneda</label>
                <select 
                  className="w-full bg-white border border-surface-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-500"
                  value={selectedCurrency}
                  onChange={(e) => setSelectedCurrency(e.target.value)}
                >
                  {COMMON_CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} - {c.name}</option>)}
                  <option value="OTHER">Otra moneda (Manual)</option>
                </select>
              </div>
              
              {selectedCurrency === 'OTHER' && (
                <div className="w-full">
                  <Input 
                    label="Código (Ej: MXN)" 
                    value={customCurrency} 
                    onChange={e => setCustomCurrency(e.target.value.toUpperCase())} 
                    maxLength={3} 
                    required 
                  />
                </div>
              )}

              <div className="w-full">
                <Input 
                  label={`Valor en ${settings?.currency || 'BOB'}`} 
                  type="number" 
                  step="0.0001" 
                  placeholder="Ej: 6.96" 
                  value={rateValue} 
                  onChange={e => setRateValue(e.target.value)} 
                  required 
                  icon={<Coins size={14} />}
                />
              </div>

              <div className="sm:col-span-full flex justify-end pt-2">
                <Button type="submit" variant="primary" loading={setRateMut.isPending} icon={<Check size={16} />}>
                  Guardar Tasa
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {isLoading ? <Spinner /> :
        <div>
          {rates?.length === 0 ? (
             <p className="text-center text-surface-400 py-10 italic border border-surface-200 rounded-xl bg-white">
               No hay tasas de cambio registradas. El sistema asumirá 1:1.
             </p>
          ) : (
             <Table columns={columns} data={rates} />
          )}
        </div>
      }
    </div>
  );
}
