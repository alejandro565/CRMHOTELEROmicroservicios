require('dotenv').config();
const express = require('express');
const morgan = require('morgan');

const { connectDB } = require('./config/database');
const { connectRabbitMQ } = require('./config/rabbitmq');
const { startConsumers } = require('./events/consumer');
const { seedAll } = require('./seeders');
const errorHandler = require('./middlewares/errorHandler');

const authRoutes        = require('./routes/auth.routes');
const userRoutes        = require('./routes/user.routes');
const roleRoutes        = require('./routes/role.routes');
const permissionRoutes  = require('./routes/permission.routes');
const internalRoutes    = require('./routes/internal.routes');
const { discoveryRouter, setDiscoveryMeta } = require('./routes/discovery.routes');

const app = express();

app.use(morgan('dev'));
app.use(express.json());

setDiscoveryMeta({
  name: 'auth-service',
  port: 3002,
  database: 'auth_db',
  publishes: ['role.permissions_changed'],
  consumes: ['tenant.suspended', 'tenant.plan_changed', 'tenant.deleted', 'tenant.updated'],
  dependencies: [],
});

app.use('/',            authRoutes);
app.use('/users',       userRoutes);
app.use('/roles',       roleRoutes);
app.use('/permissions', permissionRoutes);
app.use('/internal',    internalRoutes);
app.use('/internal/discovery', discoveryRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'auth-service' }));

app.use(errorHandler);

const PORT = process.env.PORT || 3002;

async function bootstrap() {
  await connectDB();
  await connectRabbitMQ();
  await seedAll();
  await startConsumers();

  app.listen(PORT, () => {
    console.log(`[auth-service] running on port ${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('[auth-service] fatal startup error:', err);
  process.exit(1);
});

module.exports = app;
