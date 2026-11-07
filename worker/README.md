# RetroStation Cloud Save Vault (v2)

Free, zero-cost cloud sync for saves, states, SRAM/RTC and cover art via Cloudflare.
**ROM binaries are never synced** — users re-link ROM files on each device (see `MissingRomModal`).

## What changed from v1

- **One R2 object per save item** instead of one giant JSON blob (`v2/{CODE}/{itemKey}`)
  → big save states no longer force re-uploading your whole library.
- **Durable Object (`VaultDO`) per sync code** → every read/write is serialized and stamped
  with a *server* timestamp. Client clocks no longer decide who wins; two devices syncing
  at once can no longer race a read-modify-write and silently drop data.
- **Tombstones propagate.** Deleting a game (or an individual save slot) on one device
  deletes it in the vault instead of resurrecting from another device's stale copy.
- **No in-memory fallback.** If R2 isn't bound, the worker returns hard `503`s — v1
  "worked" against a memory Map and then evaporated when the isolate recycled.
- **Failures are visible.** The client retries with exponential backoff (5s → 30s → 2m → 10m)
  and the Cloud Sync modal shows a report: pulled / pushed / skipped-too-large / per-item errors.
  A failed sync never wipes your custom endpoint anymore.
- **Legacy migration.** First access to a code reads the old v1 blob (`vault:{CODE}`) and splits
  it into per-item objects automatically. The old blob is kept as a free read-only backup.

## Deploy

```bash
cd worker
npx wrangler r2 bucket create retro-vault   # if not created yet
npx wrangler deploy
```

`wrangler.toml` binds:
- `RETRO_BUCKET` → the `retro-vault` R2 bucket (10 GB free)
- `VAULT` → the `VaultDO` Durable Object (with the `v1` migration entry — required)

## API (all under `/api/sync/:code`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | service + storage status |
| GET | `/api/sync/:code` | vault index: `{revision, items: {key: {updatedAt, size}}, deleted}` |
| GET | `/api/sync/:code/item/:key` | raw item body (Content-Type by kind) |
| PUT | `/api/sync/:code/item/:key` | store item body; server stamps `updatedAt` |
| DELETE | `/api/sync/:code/item/:key` | tombstone a single item |
| POST | `/api/sync/:code/delete-games` | purge every key for `{ids: [gameId]}` |
| DELETE | `/api/sync/:code` | purge entire vault (needs `X-Confirm-Delete` header) |

Body sizes: state/state-list items are `application/json` (states carry `emuStateBase64`),
SRAM/RTC are `application/octet-stream` raw bytes, covers are `text/plain` data-URL strings.
Max 16 MB per item.

## Verify

Upload something then check `PUT` response `updatedAt` is a server timestamp, and
`GET /api/sync/:code` returns `items` with sizes. `/health` must report `"storage": "R2"`.
