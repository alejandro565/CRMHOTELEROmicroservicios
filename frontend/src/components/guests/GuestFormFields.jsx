import React, { useMemo, useState, useEffect, useRef } from 'react'
import { Country, City } from 'country-state-city'
import PhoneInput from 'react-phone-input-2'
import 'react-phone-input-2/lib/style.css'
import { Input, Select } from '../ui'

// Robust check for react-phone-input-2 export
const PhoneInputComponent = (typeof PhoneInput === 'function') 
  ? PhoneInput 
  : (PhoneInput && typeof PhoneInput.default === 'function') 
    ? PhoneInput.default 
    : null;

const DOC_TYPES = [
  { value: 'CI', label: 'C.I.' },
  { value: 'PASSPORT', label: 'Pasaporte' },
  { value: 'FOREIGN_ID', label: 'Doc. Extranjero' },
  { value: 'OTHER', label: 'Otro' },
]

const CIVIL_STATUS = ['Soltero', 'Casado', 'Divorciado', 'Viudo', 'Unión Libre']
const GENDERS = [
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Femenino' },
  { value: 'OTHER', label: 'Otro' }
]

/**
 * Custom Searchable Select - Optimized for immediate interaction
 */
export function SearchableSelect({ label, placeholder, options, value, onSelect, disabled, className }) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef(null)

  // Get current label from value
  const currentLabel = useMemo(() => {
    const found = options.find(o => o.value === value)
    return found ? found.label : ''
  }, [options, value])

  // Filter options based on search
  const filtered = useMemo(() => {
    const normalize = (str) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    const s = normalize(search)
    return options.filter(o => normalize(o.label).includes(s)).slice(0, 50)
  }, [options, search])

  // Close when clicking outside
  useEffect(() => {
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  return (
    <div className={`flex flex-col gap-1.5 relative ${className || ''}`} ref={containerRef}>
      {label && <label className="text-xs font-semibold text-surface-600 ml-1">{label}</label>}
      <div className="relative">
        <input 
          className="w-full h-10 px-4 rounded-xl border border-surface-200 text-sm text-surface-900 bg-white/70 backdrop-blur-sm outline-none transition-all duration-200 hover:border-brand-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-50 disabled:opacity-50"
          placeholder={placeholder}
          value={isOpen ? search : currentLabel}
          onChange={e => { 
            setSearch(e.target.value); 
            setIsOpen(true); 
          }}
          onFocus={() => { 
            setSearch(''); 
            setIsOpen(true); 
          }}
          disabled={disabled}
          autoComplete="off"
        />
        {isOpen && (
          <div className="absolute z-[100] w-full mt-1 bg-white border border-surface-200 rounded-xl shadow-xl max-h-60 overflow-y-auto animate-fade-in">
            {filtered.length > 0 ? (
              filtered.map(o => (
                <div
                  key={o.value}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(o.value, o.label)
                    setSearch(o.label)
                    setIsOpen(false)
                  }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-brand-50 cursor-pointer transition-colors border-b border-surface-50 last:border-0"
                >
                  {o.label}
                </div>
              ))
            ) : (
              <div className="p-4 text-xs text-surface-400 italic text-center">No hay resultados</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Reusable Guest Form Fields
 */
export default function GuestFormFields({ values, onChange, showOrigin = false }) {
  
  const countries = useMemo(() => {
    const displayNames = new Intl.DisplayNames(['es'], { type: 'region' });
    return Country.getAllCountries().map(c => {
      let name = c.name;
      try {
        // Get Spanish name from ISO code
        name = displayNames.of(c.isoCode) || c.name;
      } catch (e) {}
      
      return {
        label: name,
        value: c.isoCode
      }
    }).sort((a, b) => a.label.localeCompare(b.label, 'es'))
  }, [])

  const cities = useMemo(() => {
    if (!values.origin_country_code) return []
    try {
      return City.getCitiesOfCountry(values.origin_country_code).map(c => ({
        label: c.name,
        value: c.name
      }))
    } catch (e) {
      return []
    }
  }, [values.origin_country_code])

  const handleNameChange = (field, val) => {
    const cleaned = (val || '').replace(/[0-9]/g, '')
    onChange(field, cleaned)
  }

  const handleFieldChange = (field, value) => {
    onChange(field, value);
  }

  return (
    <div className="space-y-4">
      {/* Name and Last Name */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input 
          label="Nombres *" 
          placeholder="Ej: Juan Antonio" 
          value={values.first_name || ''} 
          onChange={e => handleNameChange('first_name', e.target.value)} 
          required
          autoComplete="off"
        />
        <Input 
          label="Apellidos *" 
          placeholder="Ej: Pérez García" 
          value={values.last_name || ''} 
          onChange={e => handleNameChange('last_name', e.target.value)} 
          required
          autoComplete="off"
        />
      </div>

      {/* Document Type and Number */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Select 
          label="Tipo Documento *" 
          value={values.doc_type || 'CI'} 
          onChange={e => handleFieldChange('doc_type', e.target.value)}
        >
          {DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
        </Select>
        <div className="md:col-span-2">
          <Input 
            label="Número de Documento *" 
            placeholder="Nro de identidad o pasaporte" 
            value={values.doc_number || ''} 
            onChange={e => handleFieldChange('doc_number', e.target.value)} 
            required
            autoComplete="off"
          />
        </div>
      </div>

      {/* Email and Phone */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input 
          label="Correo Electrónico" 
          type="email" 
          placeholder="Ej: juan@mail.com" 
          value={values.email || ''} 
          onChange={e => handleFieldChange('email', e.target.value)} 
          autoComplete="off"
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-surface-600 ml-1">Teléfono</label>
          {PhoneInputComponent ? (
            <PhoneInputComponent
              country={'bo'}
              value={values.phone || ''}
              onChange={phone => handleFieldChange('phone', phone)}
              inputClass="!w-full !h-10 !rounded-xl !border !border-surface-200 !text-sm !bg-white/70 !outline-none focus:!border-brand-500 focus:!ring-4 focus:!ring-brand-50"
              buttonClass="!rounded-l-xl !border-surface-200 !bg-white/70"
              containerClass="!w-full"
              placeholder="+591 ..."
              inputProps={{ autoComplete: 'off' }}
            />
          ) : (
            <Input 
              placeholder="+591 ..." 
              value={values.phone || ''} 
              onChange={e => handleFieldChange('phone', e.target.value)} 
              autoComplete="off"
            />
          )}
        </div>
      </div>

      {/* Nationality and Gender */}
      <div className="grid grid-cols-2 gap-4">
        <SearchableSelect 
          label="Nacionalidad *"
          placeholder="Buscar país..."
          options={countries}
          value={countries.find(c => c.label === values.nationality)?.value || ''}
          onSelect={(code, name) => handleFieldChange('nationality', name)}
        />
        <Select 
          label="Género" 
          value={values.gender || 'M'} 
          onChange={e => handleFieldChange('gender', e.target.value)}
        >
          {GENDERS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
        </Select>
      </div>

      {/* Birth Date and Civil Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input 
          label="Fecha de Nacimiento" 
          type="date" 
          value={values.birth_date || ''} 
          onChange={e => handleFieldChange('birth_date', e.target.value)} 
          autoComplete="off"
        />
        <Select 
          label="Estado Civil" 
          value={values.civil_status || 'Soltero'} 
          onChange={e => handleFieldChange('civil_status', e.target.value)}
        >
          {CIVIL_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
        </Select>
      </div>

      {/* Origin (Optional section) */}
      {showOrigin && (
        <div className="pt-4 border-t border-dashed border-surface-200 space-y-4">
          <p className="text-xs font-bold text-surface-500 uppercase tracking-widest">Procedencia del Viaje</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SearchableSelect 
              label="País de Procedencia"
              placeholder="Buscar país..."
              options={countries}
              value={values.origin_country_code || countries.find(c => c.label === values.origin_country)?.value || ''}
              onSelect={(code, name) => {
                onChange({
                  origin_country_code: code,
                  origin_country: name,
                  origin_city: ''
                })
              }}
            />
            <SearchableSelect 
              label="Ciudad de Procedencia"
              placeholder="Buscar ciudad..."
              options={cities}
              value={values.origin_city}
              onSelect={(val, label) => handleFieldChange('origin_city', val)}
              disabled={!values.origin_country_code}
            />
          </div>
        </div>
      )}
    </div>
  )
}
