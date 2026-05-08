# Deploying Hugo

**Railway** hosts the backend, Postgres, and Redis.  
**Vercel** hosts the Next.js frontend.  
Both have free tiers sufficient for a portfolio project.

---

## 0. Prerequisites

- GitHub account with this repo pushed to it
- [railway.app](https://railway.app) account (sign in with GitHub)
- [vercel.com](https://vercel.com) account (sign in with GitHub)
- Anthropic API key
- Voyage AI API key

---

## 1. Deploy the backend on Railway

### 1a. Create a new Railway project

1. Go to [railway.app/new](https://railway.app/new)
2. Click **Deploy from GitHub repo** → select this repo
3. When asked which directory, set the **Root Directory** to `backend`
4. Railway detects the Dockerfile automatically — confirm

### 1b. Add Postgres

1. In your Railway project dashboard, click **+ New** → **Database** → **PostgreSQL**
2. Railway provisions a Postgres 16 instance and sets `DATABASE_URL` in the environment automatically — but it uses the `postgres://` scheme. You need `postgresql+asyncpg://`.

In the backend service's **Variables** tab, add:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

Then click the variable value and prepend the driver — change `postgres://` → `postgresql+asyncpg://` in the reference, or add a separate override:

```
DATABASE_URL=postgresql+asyncpg://USER:PASS@HOST:PORT/DB
```

You can copy the individual parts from the Postgres service's **Connect** tab and assemble the URL.

### 1c. Add Redis

1. Click **+ New** → **Database** → **Redis**
2. Railway sets `REDIS_URL` automatically. In the backend service's **Variables** tab add:

```
REDIS_URL=${{Redis.REDIS_URL}}
```

### 1d. Set all remaining environment variables

In the backend service **Variables** tab, add:

| Variable | Value |
|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` |
| `VOYAGE_API_KEY` | `pa-...` |
| `SESSION_SECRET` | run `openssl rand -hex 32` and paste the result |
| `PRODUCTION` | `true` |
| `LOG_JSON` | `true` |
| `ALLOWED_ORIGINS` | your Vercel frontend URL (fill in after step 2, e.g. `https://hugo.vercel.app`) |

Leave `MOCK_PROVIDERS` unset (defaults to `false`).

### 1e. Deploy

Railway builds and deploys automatically on every push. Watch the **Deploy Logs** tab — you should see:

```
INFO  Running migrations...
INFO  seed_user_exists  email=dev@hugo.local
INFO  startup_complete
```

### 1f. Note your backend URL

In the backend service, go to **Settings** → **Networking** → **Generate Domain**.  
You'll get something like `hugo-backend-production.up.railway.app`. Keep this — you need it for Vercel.

---

## 2. Deploy the frontend on Vercel

### 2a. Import the project

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import this GitHub repo
3. Set **Root Directory** to `frontend`
4. Framework preset: **Next.js** (auto-detected)

### 2b. Set environment variables

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://YOUR-RAILWAY-DOMAIN.up.railway.app` |
| `NEXT_PUBLIC_WS_URL` | `wss://YOUR-RAILWAY-DOMAIN.up.railway.app` |

Note `wss://` (not `ws://`) — Railway terminates TLS for you.

### 2c. Deploy

Click **Deploy**. Vercel builds and deploys in ~2 minutes.  
Your frontend URL will be something like `https://hugo-abc123.vercel.app`.

---

## 3. Wire the two together

### 3a. Update ALLOWED_ORIGINS on Railway

Go back to the Railway backend service → **Variables** and set:

```
ALLOWED_ORIGINS=https://YOUR-VERCEL-URL.vercel.app
```

Railway redeploys automatically.

### 3b. Test

Open your Vercel URL, enter any email, click **Dev login**.  
You should be connected and chatting with Hugo.

---

## 4. Custom domain (optional)

**Frontend (Vercel):** Project Settings → Domains → Add your domain.

**Backend (Railway):** Service Settings → Networking → Custom Domain.  
If you add a custom API domain (e.g. `api.yourdomain.com`), update `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`, and `ALLOWED_ORIGINS` to match.

---

## Troubleshooting

**`could not connect to server` on first deploy**  
The migration ran before Postgres finished provisioning. Trigger a manual redeploy from Railway's dashboard.

**WebSocket connection stuck on "connecting"**  
Check that `NEXT_PUBLIC_WS_URL` uses `wss://` (not `ws://`) and that `ALLOWED_ORIGINS` on Railway matches the exact Vercel origin (no trailing slash).

**Cookie not being set (login works but /me returns 401)**  
The `secure` cookie flag requires HTTPS. Make sure `PRODUCTION=true` is set in Railway. Also check that the Vercel frontend is making requests to the correct `NEXT_PUBLIC_API_URL`.

**`pg_trgm` extension missing**  
Railway's Postgres 16 includes `pg_trgm` by default. If you see `could not open extension "pg_trgm"` it means your Postgres plan doesn't have it. Re-provision a fresh Postgres instance — Railway's default does support it.

**pgvector extension missing**  
Railway's Postgres 16 includes pgvector. If you see errors about the `vector` type, add `POSTGRES_INITDB_ARGS=--extensions=vector` in the Postgres service variables, or connect directly and run `CREATE EXTENSION IF NOT EXISTS vector;`.

---

## Estimated cost

| Service | Free tier | Notes |
|---|---|---|
| Railway backend | $5/mo hobby after trial | Includes 512MB RAM, enough for this app |
| Railway Postgres | Included in hobby | 1GB storage |
| Railway Redis | Included in hobby | 256MB memory |
| Vercel frontend | Free | Unlimited for personal projects |
| Anthropic API | Pay-per-use | ~$0.003–0.015 per conversation turn |
| Voyage AI | Free tier: 50M tokens/mo | More than enough for a portfolio project |
