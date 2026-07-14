import React from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../../services/api.client'
import ENDPOINTS from '../../config/api.config'
import { Card, CardHeader, CardBody, Badge, PageHeader, Spinner } from '../../components/ui'

export default function PlansPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn:  () => api.get(ENDPOINTS.saas.listPlans()),
  })

  const plans = data?.data || []

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div>
      <PageHeader title="Planes SaaS" subtitle="Catálogo de planes disponibles" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {plans.map((plan) => {
          const maxHotels = plan.max_hotels === 0
            ? 'Hoteles ilimitados'
            : `Hasta ${plan.max_hotels} hotel${plan.max_hotels !== 1 ? 'es' : ''}`

          const maxRooms = plan.max_rooms_per_hotel === 0
            ? 'Habitaciones ilimitadas'
            : `${plan.max_rooms_per_hotel} hab. por hotel`

          return (
            <Card key={plan.id} className="flex flex-col">
              <CardHeader className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                  <p className="text-2xl font-bold text-indigo-600 mt-1">
                    Bs {parseFloat(plan.price).toFixed(0)}
                    <span className="text-sm font-normal text-gray-400">/mes</span>
                  </p>
                </div>
                <Badge color={plan.is_active ? 'green' : 'gray'}>
                  {plan.is_active ? 'Activo' : 'Inactivo'}
                </Badge>
              </CardHeader>

              <CardBody className="flex-1 flex flex-col gap-3">
                {/* Limits */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🏨</span>
                    <span className="text-xs text-gray-600">{maxHotels}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base">🛏</span>
                    <span className="text-xs text-gray-600">{maxRooms}</span>
                  </div>
                </div>

                {/* Modules */}
                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-gray-50">
                  {(plan.modules || []).map(m => (
                    <Badge key={m.id || m} color="indigo">{m.id || m}</Badge>
                  ))}
                </div>
              </CardBody>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
