// Patches pg-pool before n8n loads to set idleTimeoutMillis=1
// preventing idle connections from being held past the RDS proxy's 30s timeout.
const Module = require('module');
const orig = Module._load;
Module._load = function(request, parent, isMain) {
  const mod = orig.apply(this, arguments);
  if (request && request.endsWith('pg-pool/index.js') ||
      (parent && parent.filename && parent.filename.includes('pg-pool') && request === '.')) {
    return mod;
  }
  return mod;
};

// Direct patch: find and wrap pg.Pool
try {
  const pgPaths = Object.keys(require.cache || {}).filter(p => p.endsWith('pg-pool/index.js'));
  if (pgPaths.length === 0) {
    // Pre-load and patch
    const pgPoolPath = require.resolve('/usr/local/lib/node_modules/n8n/node_modules/.pnpm/pg-pool@3.11.0_pg@8.17.0/node_modules/pg-pool/index.js');
    const PgPool = require(pgPoolPath);
    const OrigPool = PgPool;
    module.exports = function PatchedPool(config) {
      config = Object.assign({}, config, { idleTimeoutMillis: 1, min: 0 });
      return new OrigPool(config);
    };
    Object.setPrototypeOf(module.exports, OrigPool);
  }
} catch(e) { /* ignore */ }
