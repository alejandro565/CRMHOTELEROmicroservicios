const { ExchangeRate } = require('../models');
const AppError = require('../middlewares/AppError');

async function setRate({ tenant_id, currency, rate, set_by_user_id }) {
  if (!currency || currency.length !== 3) throw new AppError('currency debe ser código ISO de 3 letras', 400, 'INVALID_CURRENCY');
  const date = new Date().toISOString().split('T')[0];

  const [record, created] = await ExchangeRate.findOrCreate({
    where: { tenant_id, currency, date },
    defaults: { tenant_id, currency, rate, date, set_by_user_id },
  });
  if (!created) await record.update({ rate, set_by_user_id });

  return record;
}

async function getRate(tenant_id, currency) {
  if (currency === 'BOB') return { currency: 'BOB', rate: 1.0, date: new Date().toISOString().split('T')[0] };

  const rate = await ExchangeRate.findOne({
    where: { tenant_id, currency },
    order: [['date', 'DESC']],
  });
  if (!rate) throw new AppError(`Sin tasa registrada para ${currency}`, 404, 'EXCHANGE_RATE_NOT_FOUND', { currency });
  return rate;
}

async function listRates(tenant_id) {
  return ExchangeRate.findAll({ where: { tenant_id }, order: [['date', 'DESC'], ['currency', 'ASC']] });
}

module.exports = { setRate, getRate, listRates };
