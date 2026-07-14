require('dotenv').config();
const express = require('express');
const morgan  = require('morgan');

const { connectDB }       = require('./config/database');
const { connectRabbitMQ } = require('./config/rabbitmq');
const { startJobs }       = require('./jobs');
const { startConsumers }  = require('./events/consumer');
const errorHandler        = require('./middlewares/errorHandler');

const availabilityRoutes  = require('./routes/availability.routes');
const reservationRoutes   = require('./routes/reservation.routes');
const frontOfficeRoutes   = require('./routes/frontoffice.routes');
const loanRoutes          = require('./routes/loan.routes');
const portalRoutes        = require('./routes/portal.routes');
const internalRoutes      = require('./routes/internal.routes');
const { discoveryRouter, setDiscoveryMeta } = require('./routes/discovery.routes');

const app = express();

app.use(morgan('dev'));
app.use(express.json());

setDiscoveryMeta({
  name: 'reservation-service',
  port: 3005,
  database: 'reservation_db',
  publishes: [
    'reservation.created',
    'reservation.checkin',
    'reservation.checkout',
    'reservation.stay_extended',
    'reservation.room_alert'
  ],
  consumes: ['billing.balance_updated'],
  dependencies: ['hotels-service', 'billing-service', 'guest-service']
});

app.use('/availability',  availabilityRoutes);
app.use('/reservations',  reservationRoutes);
app.use('/front-office',  frontOfficeRoutes);
app.use('/loans',         loanRoutes);
app.use('/portal',        portalRoutes);
app.use('/internal',      internalRoutes);
app.use('/internal/discovery', discoveryRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'reservation-service' }));

app.use(errorHandler);

const PORT = process.env.PORT || 3005;

async function bootstrap() {
  await connectDB();
  await connectRabbitMQ();
  startConsumers();
  startJobs();
  app.listen(PORT, () => console.log(`[reservation-service] running on port ${PORT}`));
}

bootstrap().catch((err) => {
  console.error('[reservation-service] fatal startup error:', err);
  process.exit(1);
});

module.exports = app;
