require('dotenv').config();
const express = require('express');
const morgan  = require('morgan');

const { connectDB }       = require('./config/database');
const { connectRabbitMQ } = require('./config/rabbitmq');
const { startConsumers }  = require('./events/consumer');
const { startJobs }       = require('./jobs');
const { errorHandler }    = require('./middlewares/errorHandler');

const dashboardRoutes = require('./routes/dashboard.routes');
const reportsRoutes   = require('./routes/reports.routes');
const { discoveryRouter, setDiscoveryMeta } = require('./routes/discovery.routes');

const app = express();
app.use(morgan('dev'));
app.use(express.json());

setDiscoveryMeta({
  name: 'reporting-service',
  port: 3009,
  database: 'reporting_db',
  publishes: [],
  consumes: ['reservation.checkin', 'reservation.checkout', 'reservation.created', 'billing.shift_closed', 'billing.folio_cleared'],
  dependencies: ['billing-service', 'reservation-service'],
});

app.use('/dashboard', dashboardRoutes);
app.use('/reports',   reportsRoutes);
app.use('/internal/discovery', discoveryRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'reporting-service' }));
app.use(errorHandler);

const PORT = process.env.PORT || 3009;

async function bootstrap() {
  await connectDB();
  await connectRabbitMQ();
  await startConsumers();
  startJobs();
  app.listen(PORT, () => console.log(`[reporting-service] running on port ${PORT}`));
}

bootstrap().catch((err) => {
  console.error('[reporting-service] fatal startup error:', err);
  process.exit(1);
});

module.exports = app;
