require('dotenv').config();
const express = require('express');
const morgan  = require('morgan');

const { connectDB }       = require('./config/database');
const { connectRabbitMQ } = require('./config/rabbitmq');
const { startConsumers }  = require('./events/consumer');
const errorHandler        = require('./middlewares/errorHandler');

const auditRoutes    = require('./routes/audit.routes');
const internalRoutes = require('./routes/internal.routes');
const { discoveryRouter, setDiscoveryMeta } = require('./routes/discovery.routes');

const app = express();
app.use(morgan('dev'));
app.use(express.json());

setDiscoveryMeta({
  name: 'audit-service',
  port: 3008,
  database: 'audit_db',
  publishes: [],
  consumes: [
    'tenant.provisioned', 'tenant.suspended', 'tenant.deleted',
    'reservation.created', 'reservation.checkin', 'reservation.checkout',
    'billing.folio_cleared', 'billing.shift_closed', 'billing.invoice_generated',
    'guest.merged', 'loyalty.level_up', 'room.status_changed', 'data.changed',
  ],
  dependencies: [],
});

app.use('/audit',    auditRoutes);
app.use('/internal', internalRoutes);
app.use('/internal/discovery', discoveryRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'audit-service' }));
app.use(errorHandler);

const PORT = process.env.PORT || 3008;

async function bootstrap() {
  await connectDB();
  await connectRabbitMQ();
  await startConsumers();
  app.listen(PORT, () => console.log(`[audit-service] running on port ${PORT}`));
}

bootstrap().catch((err) => {
  console.error('[audit-service] fatal startup error:', err);
  process.exit(1);
});

module.exports = app;
