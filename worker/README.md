# RetroStation Cloud Save Vault (Cloudflare Worker)

Zero-cost, edge-powered cloud save backend for **RetroStation**.

- **Cost:** $0.00 / Free forever
- **Latency:** <50ms globally via Cloudflare Edge
- **Storage:** 10 GB free object storage (Cloudflare R2) or 1 GB free KV (Cloudflare KV)
- **Bandwidth/Egress:** $0.00 unlimited free bandwidth

---

## 2-Minute Quick Deploy

### Step 1: Install Wrangler & Log In (Free Cloudflare Account)
If you don't already have a free Cloudflare account, sign up at [cloudflare.com](https://cloudflare.com).

```bash
cd worker
npx wrangler login
```

### Step 2: Create Storage (R2 Bucket or KV)
Run either command:

**Option A: Cloudflare R2 (Recommended - 10 GB free forever):**
```bash
npx wrangler r2 bucket create retro-vault
```

*OR*

**Option B: Cloudflare KV (100,000 requests/day free):**
```bash
npx wrangler kv:namespace create RETRO_VAULT
```
*(If choosing KV, paste the returned ID into `wrangler.toml` under `[[kv_namespaces]]`)*

### Step 3: Deploy!
```bash
npx wrangler deploy
```

Wrangler will output your public worker URL, for example:
```
https://retro-vault.<your-subdomain>.workers.dev
```

### Step 4: Connect in RetroStation
1. Open **RetroStation** on your phone, tablet, or PC.
2. Tap the **Cloud** icon in the header.
3. Open **Custom Cloud Vault Server (Optional)** and paste your Worker URL.
4. Tap **Generate New Sync Code** (or enter your existing code).
5. Done! All your cartridge saves (`.srm/.sav`), save states, and game covers sync automatically across devices.
