require('dotenv').config();
const express = require('express');
const morgan  = require('morgan');

const { connectDB }       = require('./config/database');
const { connectRabbitMQ } = require('./config/rabbitmq');
const { startConsumers }  = require('./events/consumer');
const errorHandler        = require('./middlewares/errorHandler');

const guestRoutes    = require('./routes/guest.routes');
const companyRoutes  = require('./routes/company.routes');
const loyaltyRoutes  = require('./routes/loyalty.routes');
const internalRoutes = require('./routes/internal.routes');
const { discoveryRouter, setDiscoveryMeta } = require('./routes/discovery.routes');

const app = express();

app.use(morgan('dev'));
app.use(express.json());

setDiscoveryMeta({
  name: 'guest-service',
  port: 3004,
  database: 'guest_db',
  publishes: ['guest.merged', 'loyalty.level_up'],
  consumes: ['reservation.checkout', 'tenant.provisioned'],
  dependencies: ['audit-service'],
});

app.use('/guests',   guestRoutes);
app.use('/companies', companyRoutes);
app.use('/loyalty',  loyaltyRoutes);
app.use('/internal', internalRoutes);
app.use('/internal/discovery', discoveryRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'guest-service' }));

app.use(errorHandler);

const PORT = process.env.PORT || 3004;

async function bootstrap() {
  await connectDB();
  await connectRabbitMQ();
  await startConsumers();
  app.listen(PORT, () => console.log(`[guest-service] running on port ${PORT}`));
}

bootstrap().catch((err) => {
  console.error('[guest-service] fatal startup error:', err);
  process.exit(1);
});

module.exports = app;
