import React, { useState } from 'react'
import { Outlet, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Sidebar from './Sidebar'
import { Menu } from 'lucide-react'

export default function AppLayout() {
  const { isAuthenticated } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()
  
  // Close menu on route change
  React.useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  if (!isAuthenticated) return <Navigate to="/login" replace />
  
  return (
    <div className="flex h-screen bg-brand-50 w-full overflow-hidden relative">
      <Sidebar mobileMenuOpen={mobileMenuOpen} onCloseMobileMenu={() => setMobileMenuOpen(false)} />
      
      <main className="flex-1 overflow-y-auto relative h-full w-full">
        {/* Mobile Header Toggle */}
        <div className="md:hidden flex items-center justify-between p-4 bg-surface-900 text-white sticky top-0 z-20 shadow-md">
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 relative flex items-center justify-center shrink-0">
               <div className="absolute inset-0 bg-brand-500 rounded-xl rotate-3"></div>
               <div className="absolute inset-0 bg-indigo-600 rounded-xl -rotate-3 opacity-70"></div>
               <span className="relative text-white font-heading font-bold text-lg">H</span>
             </div>
             <span className="font-heading font-bold text-lg tracking-tight">HotelCRM</span>
          </div>
          <button onClick={() => setMobileMenuOpen(true)} className="p-2 bg-surface-800 rounded-lg hover:bg-surface-700">
            <Menu size={24} />
          </button>
        </div>

        {/* Decorative Global Background Gradients */}
        <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-brand-200/40 rounded-full blur-[120px] pointer-events-none -translate-y-1/2 translate-x-1/4"></div>
        <div className="absolute bottom-1/4 left-1/4 w-1/4 h-1/4 bg-accent/10 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="max-w-[1400px] w-full mx-auto px-6 py-8 relative z-10 animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
