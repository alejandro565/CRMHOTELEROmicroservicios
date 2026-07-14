const svc = require('../services/exchangeRate.service');
const AppError = require('../middlewares/AppError');

async function set(req, res, next) {
  try {
    const { currency, rate } = req.body;
    if (!currency || !rate) return next(new AppError('currency y rate son requeridos', 400, 'MISSING_FIELDS'));
    const data = await svc.setRate({ tenant_id: req.user.tid, currency: currency.toUpperCase(), rate: parseFloat(rate), set_by_user_id: req.user.sub });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function list(req, res, next) {
  try {
    const data = await svc.listRates(req.user.tid);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function getCurrent(req, res, next) {
  try {
    const data = await svc.getRate(req.user.tid, req.params.currency.toUpperCase());
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

module.exports = { set, list, getCurrent };
