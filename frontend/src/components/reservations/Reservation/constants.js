

export const STEPS = [
  { n: 1, label: 'Habitaciones' },
  { n: 2, label: 'Huéspedes'    },
  { n: 3, label: 'Confirmación' },
];

export const calculateAge = (birthDate) => {
  if (!birthDate) return 18;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

export const emptyGuest = () => ({
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
  origin_country: '',
  origin_city: '',
  origin_country_code: ''
});
