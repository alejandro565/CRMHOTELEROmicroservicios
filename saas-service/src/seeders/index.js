const { Plan, SystemModule, PlanModule } = require('../models');

const DEFAULT_MODULES = [
  { 
    id: 'HOTELS',      
    name: 'Infraestructura y Habitaciones', 
    description: 'Configuración de hoteles, tipos de habitación y estado físico del inventario.' 
  },
  { 
    id: 'GUESTS',      
    name: 'Gestión de Huéspedes (CRM)',      
    description: 'Base de datos de clientes, perfiles de empresas y programas de lealtad.' 
  },
  { 
    id: 'RESERVATIONS',
    name: 'Reservas y FrontOffice',  
    description: 'Motor de reservas, ocupación, Check-in/Out y asignación de habitaciones.' 
  },
  { 
    id: 'BILLING',     
    name: 'Cuentas y Facturación',    
    description: 'Gestión de folios de huéspedes, cargos, pagos multi-moneda y facturación fiscal.' 
  },
  { 
    id: 'AUDIT',       
    name: 'Auditoría de Sistema',  
    description: 'Registro histórico de todas las acciones realizadas por los usuarios.' 
  },
  { 
    id: 'REPORTING',   
    name: 'Reportes y Analítica',  
    description: 'Generación de reportes operativos, financieros y estadísticas gerenciales.' 
  }
];

const DEFAULT_PLANS = [
  {
    name: 'Básico',
    price: 99.00,
    max_hotels: 1,
    max_rooms_per_hotel: 20,
    modules: ['HOTELS', 'GUESTS', 'RESERVATIONS', 'BILLING', 'AUDIT', 'REPORTING'],
  },
  {
    name: 'Premium',
    price: 249.00,
    max_hotels: 3,
    max_rooms_per_hotel: 100,
    modules: ['HOTELS', 'GUESTS', 'RESERVATIONS', 'BILLING', 'AUDIT', 'REPORTING'],
  },
  {
    name: 'Enterprise',
    price: 499.00,
    max_hotels: 0,
    max_rooms_per_hotel: 0, // unlimited
    modules: ['HOTELS', 'GUESTS', 'RESERVATIONS', 'BILLING', 'AUDIT', 'REPORTING'],
  },
];

async function seedPlans() {
  try {
    // 1. Upsert modules (idempotent)
    for (const mod of DEFAULT_MODULES) {
      await SystemModule.findOrCreate({ where: { id: mod.id }, defaults: mod });
    }
    console.log('[Seeder] system_modules ready');

    // 2. Upsert plans + their module links
    for (const planData of DEFAULT_PLANS) {
      const { modules, ...planFields } = planData;

      const [plan, created] = await Plan.findOrCreate({
        where:    { name: planFields.name },
        defaults: planFields,
      });

      if (!created) {
        // Update limits in case the seeder values changed
        await plan.update({
          max_hotels:          planFields.max_hotels,
          max_rooms_per_hotel: planFields.max_rooms_per_hotel,
          price:               planFields.price,
        });
        console.log(`[Seeder] plan "${plan.name}" updated`);
      } else {
        const records = modules.map((module_id) => ({ plan_id: plan.id, module_id }));
        await PlanModule.bulkCreate(records, { ignoreDuplicates: true });
        console.log(`[Seeder] plan "${plan.name}" created with ${modules.length} modules`);
      }
    }

    console.log('[Seeder] seed complete');
  } catch (err) {
    console.error('[Seeder] failed:', err.message);
    throw err;
  }
}

module.exports = { seedPlans };

