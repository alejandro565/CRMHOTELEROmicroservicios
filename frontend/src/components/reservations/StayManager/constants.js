import { Banknote, QrCode, CreditCard, Building, Wallet } from 'lucide-react';

export const DOC_TYPES = [
  { value: 'CI', label: 'C.I.' },
  { value: 'PASSPORT', label: 'Pasaporte' },
  { value: 'FOREIGN_ID', label: 'Doc. Extranjero' },
];

export const CIVIL_STATUS = ['Soltero', 'Casado', 'Divorciado', 'Viudo', 'Unión Libre'];
export const GENDERS = [{ value: 'M', label: 'Masculino' }, { value: 'F', label: 'Femenino' }, { value: 'OTHER', label: 'Otro' }];

export const PAYMENT_METHODS = [
  { id: 'CASH', label: 'Efectivo', icon: Banknote },
  { id: 'QR_PAY', label: 'Pago QR', icon: QrCode },
  { id: 'CREDIT_CARD', label: 'Tarjeta Crédito', icon: CreditCard },
  { id: 'DEBIT_CARD', label: 'Tarjeta Débito', icon: CreditCard },
  { id: 'BANK_TRANSFER', label: 'Transferencia', icon: Building },
  { id: 'OTHER', label: 'Otro', icon: Wallet },
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

export function emptyGuest() {
  return {
    first_name: '',
    last_name: '',
    doc_type: 'CI',
    doc_number: '',
    email: '',
    phone: '',
    nationality: '',
    gender: 'M',
    birth_date: '',
    civil_status: 'Soltero',
    origin_country_code: '',
  };
}
