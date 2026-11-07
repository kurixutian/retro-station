// ============================================================================
// RetroStation Cloud Save Vault - Durable Object (one per sync code)
//
// Why a DO: the old design was "client LWW + client clocks against one giant
// JSON blob". Two devices syncing at once could race the read-modify-write and
// one device's saves would silently vanish. A single DO per sync code
// serializes every read/write for that vault, stamps server timestamps, and
// keeps a tombstone index so deletes propagate instead of resurrecting.
//
// Storage layout (R2):
//   v2/{CODE}/{itemKey}   one object per syncable item (raw bytes)
//   vault:{CODE}          LEGACY v1 all-in-one blob; migrated on first access
//
// Index lives in DO storage ('index'):
//   { revision, items: {key: {updatedAt, size}}, deleted: {key: {updatedAt}} }
//
// Routing: worker forwards to  https://vault.internal/{CODE}/{route}/...
// The vault code is always the first path segment.
// ============================================================================

const MAX_ITEM_BYTES = 16 * 1024 * 1024; // per-item hard cap, validated via Content-Length
const FORBIDDEN_PREFIXES = ['rom:', 'rom_', 'autosave:'];

function isAcceptableKey(key) {
  if (typeof key !== 'string' || key.length === 0 || key.length > 120) return false;
  if (!/^[A-Za-z0-9_\-\.:]+$/.test(key)) return false;
  if (FORBIDDEN_PREFIXES.some((p) => key.startsWith(p))) return false;
  // whitelisted prefixes/shapes (keep aligned with isSyncableKey on the client)
  return (
    key === 'retro_games' ||
    key === 'library_games' ||
    key === 'retro_deleted_games' ||
    key.startsWith('state:') ||
    key.startsWith('srm:') ||
    key.startsWith('rtc:') ||
    key.startsWith('cover:')
  );
}

function contentTypeForKey(key, given) {
  if (given) return given;
  if (key.startsWith('srm:') || key.startsWith('rtc:')) return 'application/octet-stream';
  if (key.startsWith('cover:')) return 'text/plain';
  return 'application/json';
}

export class VaultDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this._index = null; // in-memory mirror; source of truth is DO storage
    this._code = null;
  }

  get code() {
    return this._code || '';
  }

  // ---- helpers -------------------------------------------------------------

  log(...args) {
    console.log(`[VaultDO ${this.code}]`, ...args);
  }

  resp(status, body) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  r2Key(key) {
    return `v2/${this.code}/${key}`;
  }

  async loadIndex() {
    if (this._index) return this._index;
    const stored = await this.state.storage.get('index');
    if (stored) {
      this._index = stored;
      return this._index;
    }

    const migrated = await this.tryLegacyMigration();
    this._index = migrated || { revision: 0, items: {}, deleted: {} };
    await this.state.storage.put('index', this._index);
    if (migrated) {
      await this.state.storage.put('migrated_from_legacy', true);
      this.log('migrated legacy vault:', Object.keys(migrated.items).length, 'items');
    }
    return this._index;
  }

  /**
   * Read the old v1 mega-blob once (if any) and split it into per-item R2
   * objects so existing users keep their saves. The legacy blob itself is
   * intentionally NOT deleted - it remains a free read-only backup snapshot.
   */
  async tryLegacyMigration() {
    if (!this.env.RETRO_BUCKET || !this.code) return null;

    const legacyObj = await this.env.RETRO_BUCKET.get(`vault:${this.code}`);
    if (!legacyObj) return null;

    let blob;
    try {
      blob = await legacyObj.json();
    } catch {
      return null;
    }
    if (!blob || typeof blob !== 'object' || !blob.items || typeof blob.items !== 'object') {
      return null;
    }

    const index = { revision: 1, items: {}, deleted: {} };
    for (const [key, it] of Object.entries(blob.items)) {
      if (!isAcceptableKey(key) || !it || it.updatedAt == null || it.data == null) continue;

      let body, contentType;
      if (it.isBinary === true && typeof it.data === 'string') {
        // v1 stored binary data base64-in-JSON; convert to real bytes now
        try {
          const bin = atob(it.data);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          body = bytes;
          contentType = 'application/octet-stream';
        } catch {
          continue;
        }
      } else if (typeof it.data === 'string') {
        body = it.data;
        contentType = 'text/plain; charset=utf-8';
      } else {
        try {
          body = JSON.stringify(it.data);
        } catch {
          continue;
        }
        contentType = 'application/json';
      }

      try {
        await this.env.RETRO_BUCKET.put(this.r2Key(key), body, {
          httpMetadata: { contentType },
        });
        index.items[key] = {
          updatedAt: Number(it.updatedAt) || 0,
          size: typeof body === 'string' ? body.length : body.byteLength,
        };
      } catch (e) {
        this.log('migration put failed', key, e.message);
      }
    }

    // v1 also kept a separate deleted_games list at the blob root
    if (Array.isArray(blob.deleted_games) && blob.deleted_games.length > 0) {
      const ts = Number(blob.lastModified) || Date.now();
      try {
        await this.env.RETRO_BUCKET.put(this.r2Key('retro_deleted_games'), JSON.stringify(blob.deleted_games), {
          httpMetadata: { contentType: 'application/json' },
        });
        index.items['retro_deleted_games'] = { updatedAt: ts, size: blob.deleted_games.length };
      } catch (e) {
        this.log('migration deleted-games put failed', e.message);
      }
    }

    return Object.keys(index.items).length > 0 ? index : null;
  }

  async deleteRelated(id) {
    const idx = await this.loadIndex();
    const matched = Object.keys(idx.items).filter(
      (k) =>
        k.startsWith(`state:${id}:`) ||
        k === `srm:${id}` ||
        k === `rtc:${id}` ||
        k === `autosave:${id}` ||
        k === `cover:${id}`
    );
    for (const k of matched) {
      delete idx.items[k];
      idx.deleted[k] = { updatedAt: Date.now() };
      if (this.env.RETRO_BUCKET) {
        this.env.RETRO_BUCKET.delete(this.r2Key(k)).catch(() => {});
      }
    }
    if (matched.length > 0) {
      idx.revision++;
      await this.state.storage.put('index', idx);
    }
    return matched.length;
  }

  // ---- request routing ------------------------------------------------------

  async fetch(request) {
    const url = new URL(request.url);
    const parts = url.pathname.replace(/^\/+/, '').split('/');
    this._code = decodeURIComponent(parts[0] || '');
    const route = parts[1] || '';

    if (!this.code || this.code.length < 3 || this.code.length > 64) {
      return this.resp(400, { error: 'Invalid sync code' });
    }

    if (route === 'index' && request.method === 'GET') {
      const idx = await this.loadIndex();
      return this.resp(200, { revision: idx.revision, items: idx.items, deleted: idx.deleted });
    }

    if (route === 'item') {
      const key = parts.slice(2).join('/');
      if (!isAcceptableKey(key)) {
        return this.resp(400, { error: 'Invalid item key' });
      }
      if (request.method === 'GET') return this.getItem(key);
      if (request.method === 'PUT') return this.putItem(key, request);
      if (request.method === 'DELETE') return this.deleteItem(key);
      return this.resp(405, { error: 'Method not allowed' });
    }

    if (route === 'delete-games' && request.method === 'POST') {
      let body = {};
      try {
        body = await request.json();
      } catch {}
      const ids = Array.isArray(body.ids)
        ? body.ids.filter((i) => typeof i === 'string' && i.length > 0 && /^[A-Za-z0-9_\-\.:]+$/.test(i))
        : [];
      if (ids.length === 0) return this.resp(400, { error: 'ids array required' });

      let deleted = 0;
      for (const id of ids) deleted += await this.deleteRelated(id);
      const idx = await this.loadIndex();
      return this.resp(200, { deleted, revision: idx.revision });
    }

    if (route === 'purge' && request.method === 'DELETE') {
      const confirm = request.headers.get('X-Confirm-Delete');
      if (confirm !== 'true' && confirm !== this.code) {
        return this.resp(403, { error: 'Missing X-Confirm-Delete header' });
      }
      await this.state.storage.deleteAll();
      this._index = { revision: 0, items: {}, deleted: {} };
      if (this.env.RETRO_BUCKET) {
        const listing = await this.env.RETRO_BUCKET.list({ prefix: `v2/${this.code}/` });
        await Promise.all(listing.objects.map((o) => this.env.RETRO_BUCKET.delete(o.key)));
      }
      return this.resp(200, { deleted: true });
    }

    return this.resp(404, { error: 'Unknown route' });
  }

  // ---- item handlers --------------------------------------------------------

  async getItem(key) {
    const idx = await this.loadIndex();
    if (!idx.items[key]) return this.resp(404, { error: 'Not found' });
    if (!this.env.RETRO_BUCKET) {
      return this.resp(503, { error: 'R2 bucket not bound to this worker' });
    }

    const obj = await this.env.RETRO_BUCKET.get(this.r2Key(key));
    if (!obj) {
      // R2 object missing (shouldn't happen) - drop from index so we don't 404 forever
      delete idx.items[key];
      idx.revision++;
      await this.state.storage.put('index', idx);
      return this.resp(404, { error: 'Not found' });
    }

    return new Response(obj.body, {
      status: 200,
      headers: {
        'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
        'X-Retro-Updated-At': String(idx.items[key].updatedAt),
        'Cache-Control': 'no-store',
      },
    });
  }

  async putItem(key, request) {
    if (!this.env.RETRO_BUCKET) {
      return this.resp(503, {
        error: 'Vault storage is not configured on this worker (R2 binding missing). Nothing was saved.',
      });
    }

    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > MAX_ITEM_BYTES) {
      return this.resp(413, { error: `Item too large (${contentLength} > ${MAX_ITEM_BYTES} bytes)` });
    }

    const idx = await this.loadIndex();
    const updatedAt = Date.now(); // SERVER clock - the whole point of this rewrite

    let body;
    try {
      body = await request.arrayBuffer();
    } catch (e) {
      return this.resp(400, { error: `Could not read body: ${e.message}` });
    }

    const contentType = contentTypeForKey(key, request.headers.get('content-type'));

    try {
      await this.env.RETRO_BUCKET.put(this.r2Key(key), body, {
        httpMetadata: { contentType },
      });
    } catch (e) {
      return this.resp(502, { error: `R2 put failed: ${e.message}` });
    }

    idx.items[key] = { updatedAt, size: body.byteLength };
    delete idx.deleted[key];
    idx.revision++;
    await this.state.storage.put('index', idx);

    return this.resp(200, { ok: true, key, updatedAt, revision: idx.revision });
  }

  async deleteItem(key) {
    const idx = await this.loadIndex();
    delete idx.items[key];
    idx.deleted[key] = { updatedAt: Date.now() };
    idx.revision++;
    await this.state.storage.put('index', idx);
    if (this.env.RETRO_BUCKET) {
      this.env.RETRO_BUCKET.delete(this.r2Key(key)).catch(() => {});
    }
    return this.resp(200, { ok: true, key });
  }
}
