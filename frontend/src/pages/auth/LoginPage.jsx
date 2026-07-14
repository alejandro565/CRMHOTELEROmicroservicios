import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Button, Input } from '../../components/ui'
import toast from 'react-hot-toast'
import { Hotel, KeyRound, Sparkles } from 'lucide-react'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm]       = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await login(form.email, form.password)

      // Owners always go to selector to allow managing/creating more hotels
      const isOwner = data.user?.role === 'OWNER' || data.user?.role_name === 'OWNER'
      
      if (data.requires_hotel_selection || isOwner) {
        navigate('/select-hotel')
        return
      }

      toast.success('Bienvenido de nuevo')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.message || 'Credenciales inválidas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-900 flex">
      {/* Columna Izquierda: Formulario (Glassmorphism) */}
      <div className="w-full lg:w-[480px] flex flex-col items-center justify-center p-8 lg:p-12 z-10 bg-white/5 backdrop-blur-xl border-r border-white/10 shadow-2xl animate-fade-in relative overflow-hidden">
        
        {/* Decorative subtle blob */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

        <div className="w-full max-w-sm relative z-10">
          <div className="mb-10">
            <div className="w-14 h-14 bg-gradient-to-br from-brand-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-500/30 mb-6">
              <Hotel className="text-white w-7 h-7" />
            </div>
            <h1 className="text-3xl font-heading font-bold text-white tracking-tight mb-2">Bienvenido</h1>
            <p className="text-surface-400 font-medium text-sm">Gestiona tu ecosistema hotelero</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Input
              label="Correo Electrónico"
              type="email"
              placeholder="gerencia@tuhotel.com"
              value={form.email}
              onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
              required
              className="[&>label]:text-surface-300 [&>input]:bg-surface-800/50 [&>input]:text-white [&>input]:border-surface-700 [&>input]:placeholder-surface-500 focus:[&>input]:border-brand-500"
            />
            <Input
              label="Contraseña"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
              required
              className="[&>label]:text-surface-300 [&>input]:bg-surface-800/50 [&>input]:text-white [&>input]:border-surface-700 [&>input]:placeholder-surface-500 focus:[&>input]:border-brand-500"
            />
            
            <div className="flex items-center justify-between mt-1">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" className="w-4 h-4 rounded border-surface-600 bg-surface-800 text-brand-500 focus:ring-brand-500/20 focus:ring-offset-0 transition-all cursor-pointer" />
                <span className="text-sm font-medium text-surface-400 group-hover:text-surface-300 transition-colors">Recordarme</span>
              </label>
              <a href="#" className="text-sm font-medium text-brand-400 hover:text-brand-300 transition-colors">¿Olvidaste tu contraseña?</a>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full justify-center mt-4 h-12 text-base shadow-[0_0_20px_rgba(59,130,246,0.3)]"
              loading={loading}
            >
              <KeyRound className="w-4 h-4" /> Entrar al Sistema
            </Button>
            
            <p className="text-center text-surface-400 text-sm mt-4">
              ¿No tienes una cuenta? <a href="/register" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">Regístrate y comienza gratis</a>
            </p>
          </form>
        </div>
      </div>

      {/* Columna Derecha: Ilustración Abstracta */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden items-center justify-center bg-gradient-to-br from-surface-900 via-surface-800 to-indigo-950">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
        
        {/* Blobs animados en el fondo */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-600/30 rounded-full blur-[100px] animate-blob"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[30rem] h-[30rem] bg-accent/20 rounded-full blur-[120px] animate-blob delay-200"></div>

        {/* Feature UI card (Imagen Ilustrativa) */}
        <div className="z-10 animate-fade-up px-8 w-full max-w-2xl">
          <img 
             src="https://th.bing.com/th/id/R.b98ca98dffc5599646e24ec2d99dd3ea?rik=z743q0BjhFdrxw&riu=http%3a%2f%2fjavierpradoinn.com%2fwp-content%2fuploads%2f2013%2f10%2fRecepcion-1.jpg&ehk=TfogfLXYxeve8bKfUbqzSvauxjx9cTuUcdCHEUcGwxo%3d&risl=&pid=ImgRaw&r=0" 
             alt="Data Dashboard Preview" 
             className="w-full h-auto rounded-xl shadow-2xl border border-white/10 opacity-90 object-cover mix-blend-luminosity hover:mix-blend-normal transition-all duration-500"
          />
        </div>
      </div>
    </div>
  )
}
