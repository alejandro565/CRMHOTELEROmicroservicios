require('dotenv').config();
const express = require('express');
const morgan  = require('morgan');

const { connectDB }       = require('./config/database');
const { connectRabbitMQ } = require('./config/rabbitmq');
const { startConsumers }  = require('./events/consumer');
const errorHandler        = require('./middlewares/errorHandler');

const shiftRoutes        = require('./routes/shift.routes');
const exchangeRateRoutes = require('./routes/exchangeRate.routes');
const folioRoutes        = require('./routes/folio.routes');
const chargeRoutes       = require('./routes/charge.routes');
const paymentRoutes      = require('./routes/payment.routes');
const invoiceRoutes      = require('./routes/invoice.routes');
const internalRoutes     = require('./routes/internal.routes');
const { discoveryRouter, setDiscoveryMeta } = require('./routes/discovery.routes');

const app = express();
app.use(morgan('dev'));
app.use(express.json());

setDiscoveryMeta({
  name: 'billing-service',
  port: 3007,
  database: 'billing_db',
  publishes: ['billing.folio_cleared', 'billing.balance_updated', 'billing.shift_closed', 'billing.invoice_generated'],
  consumes: ['reservation.created', 'reservation.stay_extended', 'item.damage_reported'],
  dependencies: [],
});

app.use('/shifts',         shiftRoutes);
app.use('/exchange-rates', exchangeRateRoutes);
app.use('/folios',         folioRoutes);
app.use('/charges',        chargeRoutes);
app.use('/payments',       paymentRoutes);
app.use('/invoices',       invoiceRoutes);
app.use('/internal',       internalRoutes);
app.use('/internal/discovery', discoveryRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'billing-service' }));
app.use(errorHandler);

const PORT = process.env.PORT || 3007;

async function bootstrap() {
  await connectDB();
  await connectRabbitMQ();
  await startConsumers();
  app.listen(PORT, () => console.log(`[billing-service] running on port ${PORT}`));
}

bootstrap().catch((err) => {
  console.error('[billing-service] fatal startup error:', err);
  process.exit(1);
});

module.exports = app;
