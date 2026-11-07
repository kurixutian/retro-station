// ============================================================================
// RetroStation Cloud Save Vault v2 - Cloudflare Worker (router only)
//
// This file is a thin CORS-validating router. All vault logic (indexing,
// serializing writes, server timestamps, legacy migration) lives in
// VaultDO (vault-do.js): one Durable Object instance per sync code.
//
// Routes (forwarded to the DO):
//   GET    /api/sync/:code                  -> vault index (keys + server timestamps)
//   GET    /api/sync/:code/item/:key        -> raw item body
//   PUT    /api/sync/:code/item/:key        -> raw item body
//   DELETE /api/sync/:code/item/:key        -> tombstone single item
//   POST   /api/sync/:code/delete-games     -> tombstone all keys for game ids
//   DELETE /api/sync/:code                  -> purge vault (X-Confirm-Delete)
// ============================================================================

import { VaultDO } from './vault-do.js';
export { VaultDO };

const VAULT_ORIGIN = 'https://vault.internal';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Confirm-Delete',
  'Access-Control-Max-Age': '86400',
};

function jsonResp(status, body, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders, ...extra },
  });
}

// RETRO-XXXX-XXXX (or any 3-64 char code for custom/self-hosted codes)
function validCode(code) {
  return /^[A-Za-z0-9_-]{3,64}$/.test(code);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // ------------------------- Health / info -------------------------
    if (url.pathname === '/' || url.pathname === '/health') {
      return jsonResp(200, {
        status: env.RETRO_BUCKET ? 'ok' : 'misconfigured',
        service: 'retro-station-vault',
        version: '2.0.0',
        storage: env.RETRO_BUCKET ? 'R2' : 'NOT-CONFIGURED (R2 binding missing)',
      });
    }

    // ------------------------- /api/sync/:code -------------------------
    const match = url.pathname.match(/^\/api\/sync\/([^/]+)(\/.*)?$/);
    if (!match) {
      return jsonResp(404, { error: 'Endpoint not found' });
    }

    const rawCode = decodeURIComponent(match[1]).trim().toUpperCase();
    if (!validCode(rawCode)) {
      return jsonResp(400, { error: 'Invalid sync code format' });
    }

    if (!env.VAULT) {
      // Be loud: the DO binding is how data actually persists.
      return jsonResp(503, { error: 'Vault Durable Object binding missing (run npx wrangler deploy with migrations)' });
    }

    const id = env.VAULT.idFromName(rawCode);
    const stub = env.VAULT.get(id);
    const rest = match[2] || '';
    // First path segment after the host is the vault code itself
    const doUrl = `${VAULT_ORIGIN}/${encodeURIComponent(rawCode)}${rest}`;
    const fwd = new Request(doUrl, {
      method: request.method,
      headers: request.headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    });

    try {
      const res = await stub.fetch(fwd);
      return new Response(res.body, {
        status: res.status,
        headers: {
          ...Object.fromEntries(res.headers),
          ...corsHeaders,
          'Content-Type': res.headers.get('Content-Type') || 'application/json',
        },
      });
    } catch (err) {
      return jsonResp(500, { error: err.message || 'Vault error' });
    }
  },
};
