require('dotenv').config();
const express = require('express');
const morgan = require('morgan');

const { connectDB } = require('./config/database');
const { connectRabbitMQ } = require('./config/rabbitmq');
const { seedPlans } = require('./seeders');
const errorHandler = require('./middlewares/errorHandler');

const planRoutes = require('./routes/plan.routes');
const moduleRoutes = require('./routes/module.routes');
const tenantRoutes = require('./routes/tenant.routes');
const internalRoutes = require('./routes/internal.routes');
const { discoveryRouter, setDiscoveryMeta } = require('./routes/discovery.routes');

const app = express();

app.use(morgan('dev'));
app.use(express.json());

setDiscoveryMeta({
  name: 'saas-service',
  port: 3001,
  database: 'saas_db',
  publishes: ['tenant.provisioned', 'tenant.suspended', 'tenant.plan_changed', 'tenant.deleted', 'tenant.updated'],
  consumes: [],
  dependencies: ['auth-service'],
});

app.use('/plans', planRoutes);
app.use('/modules', moduleRoutes);
app.use('/tenants', tenantRoutes);
app.use('/internal', internalRoutes);
app.use('/internal/discovery', discoveryRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'saas-service' }));

app.use(errorHandler);

const PORT = process.env.PORT || 3001;

async function bootstrap() {
  await connectDB();
  await connectRabbitMQ();
  await seedPlans();

  app.listen(PORT, () => {
    console.log(`[saas-service] running on port ${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('[saas-service] fatal startup error:', err);
  process.exit(1);
});

module.exports = app;
