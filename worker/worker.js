/**
 * RetroStation Cloud Save Vault - Cloudflare Worker
 *
 * Free, Zero-Cost Cloud Save Edge Vault
 * Egress Fees: $0.00 forever
 * Supports either Cloudflare KV or Cloudflare R2 object storage.
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. CORS Preflight Support for all clients & domains
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    };

    // Health Check / Root route
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          service: 'retro-station-vault',
          version: '1.0.0',
          storage: env.RETRO_BUCKET ? 'R2' : env.RETRO_VAULT ? 'KV' : 'unconfigured',
        }),
        { headers: corsHeaders }
      );
    }

    // Match Route: /api/sync/:code
    const match = url.pathname.match(/^\/api\/sync\/([^/]+)$/);
    if (!match) {
      return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    const rawCode = decodeURIComponent(match[1]).trim().toUpperCase();
    if (!rawCode || rawCode.length < 3 || rawCode.length > 64) {
      return new Response(JSON.stringify({ error: 'Invalid sync code format' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const storageKey = `vault:${rawCode}`;
    // In-memory fallback if KV/R2 binding is not configured yet
    const mem = globalThis.__retro_mem_store || (globalThis.__retro_mem_store = new Map());

    // Storage Adapter (works seamlessly with R2 Bucket, KV Namespace, or memory fallback)
    const storage = {
      async get() {
        if (env.RETRO_BUCKET) {
          const obj = await env.RETRO_BUCKET.get(storageKey);
          if (!obj) return null;
          return await obj.json();
        }
        if (env.RETRO_VAULT) {
          const raw = await env.RETRO_VAULT.get(storageKey, 'json');
          return raw;
        }
        return mem.get(storageKey) || null;
      },
      async put(data) {
        const payload = JSON.stringify(data);
        if (env.RETRO_BUCKET) {
          await env.RETRO_BUCKET.put(storageKey, payload, {
            httpMetadata: { contentType: 'application/json' },
          });
          return;
        }
        if (env.RETRO_VAULT) {
          await env.RETRO_VAULT.put(storageKey, payload);
          return;
        }
        mem.set(storageKey, data);
      },
      async delete() {
        if (env.RETRO_BUCKET) await env.RETRO_BUCKET.delete(storageKey);
        if (env.RETRO_VAULT) await env.RETRO_VAULT.delete(storageKey);
        mem.delete(storageKey);
      },
    };

    try {
      // GET: Retrieve all saves for this sync code
      if (request.method === 'GET') {
        const vault = await storage.get();
        if (!vault) {
          return new Response(
            JSON.stringify({ exists: false, items: {}, lastModified: 0 }),
            { headers: corsHeaders }
          );
        }
        return new Response(
          JSON.stringify({ exists: true, ...vault }),
          { headers: corsHeaders }
        );
      }

      // POST / PUT: Merge incoming save batch
      if (request.method === 'POST' || request.method === 'PUT') {
        let body;
        try {
          body = await request.json();
        } catch (e) {
          return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
            status: 400,
            headers: corsHeaders,
          });
        }

        const incomingItems = body.items || {};
        const clientDeviceId = body.clientDeviceId || 'unknown';

        let vault = await storage.get();
        if (!vault || !vault.items) {
          vault = { version: 1, items: {}, lastModified: Date.now() };
        }

        // Timestamp-based atomic merge (newer revision wins per save item)
        for (const [key, item] of Object.entries(incomingItems)) {
          const existing = vault.items[key];

          // Never let an empty game list from a fresh client overwrite an existing populated library
          if ((key === 'retro_games' || key === 'library_games') && existing && Array.isArray(existing.data) && existing.data.length > 0) {
            const incomingList = Array.isArray(item.data) ? item.data : [];
            if (incomingList.length === 0) {
              continue; // Keep existing games
            }
            // Additive merge by ID
            const map = new Map();
            existing.data.forEach((g) => g && g.id && map.set(g.id, g));
            incomingList.forEach((g) => g && g.id && map.set(g.id, g));
            item.data = Array.from(map.values());
          }

          if (!existing || (item.updatedAt || 0) >= (existing.updatedAt || 0)) {
            vault.items[key] = item;
          }
        }

        vault.lastModified = Date.now();
        vault.lastUpdatedBy = clientDeviceId;

        await storage.put(vault);

        return new Response(
          JSON.stringify({
            success: true,
            lastModified: vault.lastModified,
            itemCount: Object.keys(vault.items).length,
          }),
          { headers: corsHeaders }
        );
      }

      // DELETE: Delete saved vault for this code
      if (request.method === 'DELETE') {
        await storage.delete();
        return new Response(
          JSON.stringify({ success: true, message: 'Vault purged' }),
          { headers: corsHeaders }
        );
      }

      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: corsHeaders,
      });
    } catch (err) {
      console.error('Worker storage error:', err);
      return new Response(
        JSON.stringify({ error: err.message || 'Vault storage error' }),
        { status: 500, headers: corsHeaders }
      );
    }
  },
};
