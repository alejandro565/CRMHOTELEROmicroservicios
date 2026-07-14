import React from 'react'
import { createPortal } from 'react-dom'

export function Button({ children, variant = 'default', size = 'md', loading, className = '', ...props }) {
  const base = 'inline-flex justify-center items-center gap-2 font-medium rounded-xl border transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm'
  const variants = {
    default: 'bg-white/80 backdrop-blur-sm border-surface-200 text-surface-800 hover:bg-surface-50 hover:shadow-md hover:border-surface-300 active:scale-95',
    primary: 'bg-gradient-to-r from-brand-600 to-brand-500 border-transparent text-white hover:to-brand-400 hover:shadow-[0_0_15px_rgba(59,130,246,0.4)] active:scale-95 hover:-translate-y-0.5',
    secondary: 'bg-surface-200 text-surface-800 border-transparent hover:bg-surface-300 active:scale-95',
    danger:  'bg-gradient-to-r from-red-600 to-red-500 border-transparent text-white hover:to-red-400 hover:shadow-[0_0_15px_rgba(239,68,68,0.4)] active:scale-95',
    ghost:   'bg-transparent border-transparent shadow-none text-surface-600 hover:bg-surface-100 hover:text-surface-900',
    success: 'bg-gradient-to-r from-emerald-500 to-emerald-400 border-transparent text-white hover:to-emerald-300 hover:shadow-[0_0_15px_rgba(16,185,129,0.4)] active:scale-95',
    outline: 'bg-transparent border-surface-200 text-surface-700 hover:bg-surface-50 hover:text-surface-900 active:scale-95',
    white:   'bg-white text-surface-900 hover:bg-surface-50 shadow-sm border-transparent active:scale-95',
    brand:   'bg-brand-100 text-brand-700 hover:bg-brand-200 border-transparent active:scale-95',
  }
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-5 py-2.5 text-sm', lg: 'px-6 py-3 text-base' }
  
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={loading || props.disabled} {...props}>
      {loading && <Spinner size={16} className="text-current" />}
      {children}
    </button>
  )
}

export function Input({ label, error, className = '', ...props }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && <label className="text-xs font-semibold text-surface-600 ml-1">{label}</label>}
      <input className={`h-10 px-4 rounded-xl border text-sm text-surface-900 outline-none transition-all duration-200 bg-white/70 backdrop-blur-sm placeholder:text-surface-400
        ${error ? 'border-red-400 ring-4 ring-red-50 focus:border-red-500' : 'border-surface-200 hover:border-brand-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-50'}`}
        {...props} />
      {error && <p className="text-xs text-red-500 ml-1 font-medium animate-fade-in">{error}</p>}
    </div>
  )
}

export function Select({ label, children, className = '', ...props }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && <label className="text-xs font-semibold text-surface-600 ml-1">{label}</label>}
      <select className="h-10 px-4 rounded-xl border border-surface-200 text-sm text-surface-900 bg-white/70 backdrop-blur-sm outline-none transition-all duration-200 hover:border-brand-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-50" {...props}>
        {children}
      </select>
    </div>
  )
}

export function Textarea({ label, className = '', ...props }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && <label className="text-xs font-semibold text-surface-600 ml-1">{label}</label>}
      <textarea className="px-4 py-3 rounded-xl border border-surface-200 text-sm text-surface-900 bg-white/70 backdrop-blur-sm outline-none resize-none transition-all duration-200 hover:border-brand-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-50" rows={3} {...props} />
    </div>
  )
}

export function Card({ children, className = '', hoverEffect = false, ...props }) {
  return (
    <div className={`glass-card rounded-2xl ${hoverEffect ? 'hover:-translate-y-1' : ''} ${className}`} {...props}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }) {
  return <div className={`px-6 py-5 border-b border-surface-100/50 ${className}`}>{children}</div>
}
export function CardBody({ children, className = '' }) {
  return <div className={`px-6 py-5 ${className}`}>{children}</div>
}

const badgeColors = {
  green:  'bg-emerald-100 text-emerald-700 border-emerald-200/50',
  red:    'bg-red-100 text-red-700 border-red-200/50',
  yellow: 'bg-amber-100 text-amber-700 border-amber-200/50',
  blue:   'bg-brand-100 text-brand-700 border-brand-200/50',
  purple: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200/50',
  gray:   'bg-surface-100 text-surface-600 border-surface-200/50',
  indigo: 'bg-indigo-100 text-indigo-700 border-indigo-200/50',
}

export function Badge({ children, color = 'gray', className = '' }) {
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${badgeColors[color]} ${className}`}>{children}</span>
}

export function StatusBadge({ status }) {
  const map = {
    ACTIVE: { color: 'green', label: 'Activo' }, SUSPENDED: { color: 'red', label: 'Suspendido' },
    INACTIVE: { color: 'gray', label: 'Inactivo' }, CONFIRMED: { color: 'blue', label: 'Confirmada' },
    PRE_CHECKIN: { color: 'purple', label: 'Pre-Check-in' }, IN_HOUSE: { color: 'green', label: 'En casa' },
    CHECKED_OUT: { color: 'gray', label: 'Check-out' }, CANCELED: { color: 'red', label: 'Cancelada' },
    NOSHOW: { color: 'yellow', label: 'No-Show' }, CLEAN: { color: 'green', label: 'Limpia' },
    DIRTY: { color: 'yellow', label: 'Sucia' }, MAINTENANCE: { color: 'red', label: 'Mantenimiento' },
    OCCUPIED: { color: 'blue', label: 'Ocupada' }, OPEN: { color: 'green', label: 'Abierto' },
    CLOSED: { color: 'gray', label: 'Cerrado' }, SETTLED: { color: 'green', label: 'Saldado' },
  }
  const { color, label } = map[status] || { color: 'gray', label: status }
  return <Badge color={color}>{label}</Badge>
}

export function Table({ columns, data, loading, emptyMsg = 'Sin datos' }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-surface-200/50 bg-white/30 backdrop-blur-sm">
      <table className="w-full text-sm">
        <thead className="bg-surface-50/80">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="px-5 py-4 text-left text-xs font-bold text-surface-500 uppercase tracking-wider">{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-100/50">
          {loading ? (
            <tr><td colSpan={columns.length} className="text-center py-12"><Spinner className="mx-auto text-brand-500" /></td></tr>
          ) : !data?.length ? (
            <tr><td colSpan={columns.length} className="text-center py-12 text-surface-400 font-medium">{emptyMsg}</td></tr>
          ) : data.map((row, i) => (
            <tr key={row.id || i} className="hover:bg-brand-50/50 transition-colors duration-200">
              {columns.map((col) => (
                <td key={col.key} className="px-5 py-4 text-surface-700 whitespace-nowrap">
                  {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Spinner({ size = 20, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={`animate-spin ${className}`}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function Modal({ open, onClose, title, children, size = 'md' }) {
  if (!open) return null
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', '2xl': 'max-w-5xl', '3xl': 'max-w-7xl' }
  
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-surface-900/60 animate-fade-in" onClick={onClose}></div>
      
      {/* Dialog */}
      <div className={`relative bg-white rounded-2xl shadow-2xl border border-white/50 w-full ${sizes[size]} max-h-[90vh] flex flex-col animate-fade-up`}>
        <div className="flex items-center justify-between px-7 py-5 border-b border-surface-100">
          <h2 className="text-lg font-heading font-bold text-surface-900">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-lg text-surface-400 hover:text-surface-700 hover:bg-surface-100 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-7 py-6">{children}</div>
      </div>
    </div>,
    document.getElementById('modal-root')
  )
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div>
        <h1 className="text-3xl font-heading font-bold text-surface-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-surface-500 font-medium mt-1">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

export function StatCard({ label, value, sub, color = 'indigo' }) {
  const gradients = { 
    indigo: 'from-brand-500/10 to-brand-500/5 text-brand-600 border-brand-200/50', 
    green:  'from-emerald-500/10 to-emerald-500/5 text-emerald-600 border-emerald-200/50', 
    amber:  'from-amber-500/10 to-amber-500/5 text-amber-600 border-amber-200/50', 
    red:    'from-red-500/10 to-red-500/5 text-red-600 border-red-200/50' 
  }
  
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${gradients[color]} rounded-2xl p-5 border shadow-sm transition-transform duration-300 hover:-translate-y-1`}>
      <div className="relative z-10">
        <p className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">{label}</p>
        <p className="text-3xl font-heading font-bold tracking-tight">{value}</p>
        {sub && <p className="text-xs font-medium text-surface-400 mt-2">{sub}</p>}
      </div>
      {/* Decorative background blob */}
      <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-current opacity-[0.03] rounded-full blur-2xl"></div>
    </div>
  )
}
