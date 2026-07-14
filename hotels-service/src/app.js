require('dotenv').config();
const express = require('express');
const morgan  = require('morgan');

const { connectDB }      = require('./config/database');
const { connectRabbitMQ } = require('./config/rabbitmq');
const { startConsumers } = require('./events/consumer');
const errorHandler       = require('./middlewares/errorHandler');

const roomTypeRoutes   = require('./routes/roomType.routes');
const amenityRoutes    = require('./routes/amenity.routes');
const bedTypeRoutes    = require('./routes/bedType.routes');
const roomRoutes       = require('./routes/room.routes');
const settingsRoutes   = require('./routes/settings.routes');
const lendableRoutes   = require('./routes/lendable.routes');
const inventoryRoutes  = require('./routes/inventory.routes');
const houseRoutes      = require('./routes/housekeeping.routes');
const maintenanceRoutes= require('./routes/maintenance.routes');
const internalRoutes   = require('./routes/internal.routes');
const onboardingRoutes = require('./routes/onboarding.routes');

const { discoveryRouter, setDiscoveryMeta } = require('./routes/discovery.routes');

const app = express();

app.use(morgan('dev'));
app.use(express.json());

setDiscoveryMeta({
  name: 'hotels-service',
  port: 3003,
  database: 'hotels_db',
  publishes: ['room.status_changed', 'item.damage_reported', 'inventory.low_alert'],
  consumes: ['tenant.provisioned', 'reservation.checkout'],
  dependencies: [],
});

app.use('/room-types',   roomTypeRoutes);
app.use('/amenities',    amenityRoutes);
app.use('/bed-types',    bedTypeRoutes);
app.use('/rooms',        roomRoutes);
app.use('/settings',     settingsRoutes);
app.use('/lendable-items', lendableRoutes);
app.use('/inventory',    inventoryRoutes);
app.use('/housekeeping', houseRoutes);
app.use('/maintenance',  maintenanceRoutes);
app.use('/internal',     internalRoutes);
app.use('/onboarding',   onboardingRoutes);
app.use('/internal/discovery', discoveryRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'hotels-service' }));

app.use(errorHandler);

const PORT = process.env.PORT || 3003;

async function bootstrap() {
  await connectDB();
  await connectRabbitMQ();
  await startConsumers();
  app.listen(PORT, () => console.log(`[hotels-service] running on port ${PORT}`));
}

bootstrap().catch((err) => {
  console.error('[hotels-service] fatal startup error:', err);
  process.exit(1);
});

module.exports = app;
