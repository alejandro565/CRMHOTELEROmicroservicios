const { Sequelize } = require('sequelize');

const isDev = process.env.NODE_ENV === 'development';

// Sequelize tiene dos firmas distintas:
//   new Sequelize(url, options)           <- cuando usas DATABASE_URL
//   new Sequelize(db, user, pass, opts)   <- cuando usas variables individuales
// Mezclarlas en un solo argumento rompe el parser interno de Sequelize.

const sharedOptions = {
  dialect: 'postgres',
  benchmark: isDev,
  logging: isDev ? (sql, duration) => console.log(`[DB] ${duration}ms | ${sql}`) : false,
  dialectOptions: {
    // SSL en produccion: ssl: { require: true, rejectUnauthorized: false }
  },
  pool: {
    max: 15,
    min: 2,
    acquire: 30000,
    idle: 10000,
  },
};

const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, sharedOptions)
  : new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      {
        ...sharedOptions,
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
      }
    );

async function connectDB(retries = 5, delay = 5000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await sequelize.authenticate();
      console.log('[DB] Connection to "' + sequelize.config.database + '" established.');

      if (isDev) {
        await sequelize.sync({ alter: true });
        console.log('[DB] Database synchronized (alter: true)');
      }

      return;
    } catch (err) {
      console.error('[DB] Attempt ' + attempt + '/' + retries + ' failed:', err.message);

      if (attempt === retries) {
        console.error('[DB] Could not connect to database after maximum attempts.');
        process.exit(1);
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

module.exports = { sequelize, connectDB };