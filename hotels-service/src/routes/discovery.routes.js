const router = require('express').Router();
const os = require('os');

let _meta = {};

function setDiscoveryMeta(meta) {
  _meta = meta;
}

function extractRoutes(app) {
  const routes = [];
  if (!app._router) return routes;
  
  app._router.stack.forEach(layer => {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
      routes.push({ methods, path: layer.route.path, type: 'public' });
    } else if (layer.name === 'router' && layer.handle.stack) {
      const prefix = layer.regexp.source
        .replace('\\/?(?=\\/|$)', '')
        .replace(/\\\//g, '/')
        .replace(/^\^/, '')
        .replace(/\$?$/, '');
      
      layer.handle.stack.forEach(sub => {
        if (sub.route) {
          const methods = Object.keys(sub.route.methods).map(m => m.toUpperCase());
          const fullPath = `${prefix}${sub.route.path}`;
          const type = prefix.includes('internal') ? 'internal' : 'public';
          routes.push({ methods, path: fullPath, type });
        }
      });
    }
  });
  return routes;
}

router.get('/', (req, res) => {
  const app = req.app;
  res.json({
    service: _meta.name || 'unknown',
    version: _meta.version || '1.0.0',
    port: _meta.port || process.env.PORT,
    database: _meta.database || null,
    routes: extractRoutes(app),
    events: {
      publishes: _meta.publishes || [],
      consumes: _meta.consumes || [],
    },
    dependencies: _meta.dependencies || [],
    health: {
      status: 'ok',
      uptime_s: Math.floor(process.uptime()),
      memory_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      pid: process.pid,
      hostname: os.hostname(),
    },
    discovered_at: new Date().toISOString(),
  });
});

module.exports = { discoveryRouter: router, setDiscoveryMeta };
