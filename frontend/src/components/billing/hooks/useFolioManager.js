import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api.client';
import ENDPOINTS from '../../../config/api.config';
import toast from 'react-hot-toast';

export const PAYMENT_METHODS = [
  { id: 'CASH', label: 'Efectivo' },
  { id: 'QR_PAY', label: 'Pago QR' },
  { id: 'CREDIT_CARD', label: 'Tarjeta Crédito' },
  { id: 'DEBIT_CARD', label: 'Tarjeta Débito' },
  { id: 'BANK_TRANSFER', label: 'Transferencia' },
  { id: 'OTHER', label: 'Otro' },
];

export const CHARGE_CATEGORIES = [
  { id: 'ACCOMMODATION', label: 'Alojamiento' },
  { id: 'FOOD_BEVERAGE', label: 'Alimentos y Bebidas' },
  { id: 'LAUNDRY', label: 'Lavandería' },
  { id: 'SPA', label: 'Spa & Relax' },
  { id: 'MINIBAR', label: 'Consumo Minibar' },
  { id: 'PARKING', label: 'Estacionamiento' },
  { id: 'TELEPHONE', label: 'Teléfono' },
  { id: 'DAMAGE', label: 'Daños / Multas' },
  { id: 'OTHER', label: 'Otros Gastos' },
];

export default function useFolioManager(reservationId, initialTab = 'summary', onFolioSettled = null) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState(initialTab); // summary, pay, invoice, refund, add_charge
  
  // Payment State
  const [payAmount, setPayAmount] = useState('');
  const [currency, setCurrency] = useState('BOB');
  const [payMethod, setPayMethod] = useState('CASH');
  
  // Invoice State
  const [requireInvoice, setRequireInvoice] = useState(false);
  const [invoiceData, setInvoiceData] = useState({ tax_id: '', business_name: '', email: '' });

  // Charge State
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeDesc, setChargeDesc] = useState('');
  const [chargeCategory, setChargeCategory] = useState('FOOD_BEVERAGE');

  // Queries
  const { data: folioData, isLoading: loadingFolio } = useQuery({
    queryKey: ['folios', reservationId],
    queryFn: () => api.get(ENDPOINTS.billing.foliosByRes(reservationId)),
    enabled: !!reservationId,
  });

  const { data: ratesData } = useQuery({
    queryKey: ['exchange-rates'],
    queryFn: () => api.get(ENDPOINTS.billing.listRates()),
    enabled: !!reservationId,
  });

  const folios = folioData?.data || [];
  const folio = folios.find(f => f.type === 'MASTER') || folios[0];
  const rates = ratesData?.data || [];

  const charges = folios.flatMap(f => f.charges || []).sort((a,b) => {
    const da = new Date(a.created_at || a.createdAt || 0);
    const db = new Date(b.created_at || b.createdAt || 0);
    return da - db;
  });
  
  const payments = folios.flatMap(f => f.payments || []).sort((a,b) => {
    const da = new Date(a.created_at || a.createdAt || 0);
    const db = new Date(b.created_at || b.createdAt || 0);
    return da - db;
  });

  const balance = folios.reduce((acc, f) => acc + parseFloat(f.balance || 0), 0);

  // Auto-fill amount when switching to 'pay' tab if there's a balance
  useEffect(() => {
    if (activeTab === 'pay' && balance > 0 && !payAmount) {
      setPayAmount(balance.toFixed(2));
    }
  }, [activeTab, balance, payAmount]);

  const resetState = () => {
    setActiveTab('summary');
    setPayAmount('');
    setCurrency('BOB');
    setPayMethod('CASH');
    setRequireInvoice(false);
    setInvoiceData({ tax_id: '', business_name: '', email: '' });
    setChargeAmount('');
    setChargeDesc('');
    setChargeCategory('FOOD_BEVERAGE');
  };

  // Mutations
  const addPaymentMut = useMutation({
    mutationFn: (payload) => api.post(ENDPOINTS.billing.addPayment(folio?.id), payload),
    onSuccess: () => {
      toast.success('Pago registrado');
      qc.invalidateQueries({ queryKey: ['folios', reservationId] });
      setActiveTab('summary');
    },
    onError: (e) => toast.error(e.message || 'Error registrando pago')
  });

  const settleMut = useMutation({
    mutationFn: (payload) => api.post(ENDPOINTS.billing.settleFolio(folio?.id), payload),
    onSuccess: (data) => {
      toast.success('Cuenta liquidada exitosamente');
      qc.invalidateQueries({ queryKey: ['folios', reservationId] });
      qc.invalidateQueries({ queryKey: ['reservations'] });
      qc.invalidateQueries({ queryKey: ['reservation-detail'] });
      if (data?.data?.invoice) {
        toast.success('Factura generada', { icon: '🧾' });
        setActiveTab('invoice');
      } else {
        if (onFolioSettled) onFolioSettled();
      }
    },
    onError: (e) => toast.error(e.message || 'Error liquidando cuenta')
  });

  const addChargeMut = useMutation({
    mutationFn: (payload) => api.post(ENDPOINTS.billing.addCharge(), payload),
    onSuccess: () => {
      toast.success('Gasto registrado con éxito');
      qc.invalidateQueries({ queryKey: ['folios', reservationId] });
      setActiveTab('summary');
      setChargeAmount('');
      setChargeDesc('');
    },
    onError: (e) => toast.error(e.message || 'Error registrando gasto')
  });

  const calculateEquivalent = () => {
    if (!payAmount) return 0;
    if (currency === 'BOB') return parseFloat(payAmount);
    const rate = rates.find(r => r.currency === currency)?.rate;
    if (!rate) return parseFloat(payAmount);
    return parseFloat(payAmount) * parseFloat(rate);
  };

  const handleSettle = () => {
    const payload = {};
    if (balance > 0) {
      if (!payAmount || parseFloat(payAmount) <= 0) {
        toast.error('Debe ingresar un monto válido para saldar la cuenta.');
        return;
      }
      payload.payment = { method: payMethod, currency, amount: parseFloat(payAmount) };
    }
    if (requireInvoice) {
      if (!invoiceData.tax_id || !invoiceData.business_name) {
        toast.error('Datos de facturación incompletos');
        return;
      }
      payload.invoice = invoiceData;
    }
    settleMut.mutate(payload);
  };

  const handlePartialPayment = () => {
    if (!payAmount || parseFloat(payAmount) <= 0) {
      toast.error('Debe ingresar un monto válido.'); return;
    }
    addPaymentMut.mutate({ method: payMethod, currency, amount: parseFloat(payAmount) });
  };

  const handleRefund = () => {
    addPaymentMut.mutate({ method: payMethod, currency: 'BOB', amount: -Math.abs(balance) });
  };

  const handleAddCharge = () => {
    if (!chargeAmount || parseFloat(chargeAmount) <= 0 || !chargeDesc.trim()) {
      toast.error('Complete la descripción y un monto mayor a 0'); return;
    }
    addChargeMut.mutate({
      folio_id: folio.id,
      category: chargeCategory,
      description: chargeDesc,
      amount: parseFloat(chargeAmount)
    });
  };

  return {
    folio, folios, charges, payments, balance, rates, loadingFolio,
    activeTab, setActiveTab, resetState,
    payAmount, setPayAmount, currency, setCurrency, payMethod, setPayMethod,
    requireInvoice, setRequireInvoice, invoiceData, setInvoiceData,
    chargeAmount, setChargeAmount, chargeDesc, setChargeDesc, chargeCategory, setChargeCategory,
    calculateEquivalent, handleSettle, handlePartialPayment, handleRefund, handleAddCharge,
    isAddingPayment: addPaymentMut.isPending,
    isSettling: settleMut.isPending,
    isAddingCharge: addChargeMut.isPending,
  };
}
