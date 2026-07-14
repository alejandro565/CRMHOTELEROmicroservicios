const { HotelSettings } = require('../models');
const AppError = require('../middlewares/AppError');

async function getSettings(tenant_id) {
  const [s] = await HotelSettings.findOrCreate({
    where: { tenant_id },
    defaults: { 
      tenant_id,
      timezone: 'America/La_Paz',
      currency: 'BOB',
      checkin_time: '14:00',
      checkout_time: '12:00'
    }
  });
  return s;
}

async function upsertSettings(tenant_id, data) {
  const [settings] = await HotelSettings.findOrCreate({
    where: { tenant_id },
    defaults: { tenant_id, ...data },
  });
  if (Object.keys(data).length) await settings.update(data);
  return settings;
}

module.exports = { getSettings, upsertSettings };
