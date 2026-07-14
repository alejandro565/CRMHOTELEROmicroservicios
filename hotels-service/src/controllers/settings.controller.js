const svc = require('../services/settings.service');

async function get(req, res, next) {
  try {
    const data = await svc.getSettings(req.user.tid);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function upsert(req, res, next) {
  try {
    const data = await svc.upsertSettings(req.user.tid, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

module.exports = { get, upsert };
