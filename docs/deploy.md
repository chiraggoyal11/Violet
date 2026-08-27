# Deploy Violet (Render + MongoDB Atlas + AWS S3)

This is the simplest production path for Violet:

```
Browser ──► https://violet.onrender.com  (Render: Node + built React)
                │
                ├── MongoDB Atlas (database)
                └── AWS S3 violetchirag (product images)
```

Google OAuth is optional — enable it after you have the Render URL.

---

## Before you start

You need:

1. **GitHub** repo with this code (merge PRs #7 and #8, or deploy this branch)
2. **MongoDB Atlas** free cluster
3. **AWS S3** bucket `violetchirag` (you already have this)
4. **Render.com** account (free)

---

## Step 1 — MongoDB Atlas (free database)

1. Open [mongodb.com/atlas](https://www.mongodb.com/atlas) and sign in
2. Create a **free M0** cluster (pick a region near Singapore / Mumbai)
3. **Database Access** → Add user → set username + password (save them)
4. **Network Access** → Add IP → **Allow Access from Anywhere** (`0.0.0.0/0`)
5. **Connect** → **Drivers** → copy the connection string:

```text
mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/violet?retryWrites=true&w=majority
```

Replace `USER`, `PASSWORD`, and keep `/violet` as the database name.

---

## Step 2 — Deploy on Render

### Option A — Blueprint (recommended)

1. Open [dashboard.render.com](https://dashboard.render.com)
2. **New** → **Blueprint**
3. Connect GitHub → select `chiraggoyal11/Violet`
4. Branch: `main` (after merge) or `cursor/deploy-render-c505`
5. Render detects `render.yaml`
6. Fill env vars when prompted (see table below)
7. Click **Apply** and wait 5–10 minutes

### Option B — Manual Web Service

1. **New** → **Web Service**
2. Connect the Violet GitHub repo
3. Settings:
   - **Runtime:** Docker
   - **Dockerfile path:** `./Dockerfile`
   - **Plan:** Free
   - **Region:** Singapore (or Oregon)
   - **Health check path:** `/api/violet/health`
4. Add the environment variables below
5. Create Web Service

### Environment variables

| Key | Value |
|-----|--------|
| `MONGO` | Atlas connection string from Step 1 |
| `jwtSecret` | Generate in Render, or paste a long random string |
| `CORS_ORIGIN` | Leave blank first deploy, then set to your Render URL |
| `BUCKET_NAME` | `violetchirag` |
| `BUCKET_REGION` | `ap-south-1` |
| `ACCESS_KEY` | Your AWS IAM access key |
| `SECRET_ACCESS_KEY` | Your AWS IAM secret |
| `GOOGLE_CLIENT_ID` | Optional for now — add later |
| `NODE_ENV` | `production` |
| `RESET_DEV_MODE` | `false` |

After the first successful deploy, copy your public URL (e.g. `https://violet-xxxx.onrender.com`) and set:

```env
CORS_ORIGIN=https://violet-xxxx.onrender.com
```

Then **Manual Deploy** → clear build cache / redeploy once.

---

## Step 3 — Verify

1. Open `https://YOUR-APP.onrender.com/api/violet/health`  
   Expect: `{"success":true,...}`
2. Open `https://YOUR-APP.onrender.com` — homepage should load
3. Register with phone + strong password
4. List a product with an image (S3 upload)

---

## Step 4 — Enable Google login (after deploy)

1. Google Cloud Console → your OAuth Web client
2. **Authorized JavaScript origins** → add:
   ```
   https://YOUR-APP.onrender.com
   ```
3. **Authorized redirect URIs** → add the same URL
4. Save
5. On Render, set `GOOGLE_CLIENT_ID` to your Client ID
6. **Manual Deploy → Clear build cache & deploy** (required so the Client ID is baked into the frontend)

The Docker build copies `GOOGLE_CLIENT_ID` into the SPA as `VITE_GOOGLE_CLIENT_ID`, so **Continue with Google** still shows even if `/api/violet/auth/config` is slow or returns 502 during a free-tier wake-up. The SPA also retries that config endpoint a few times as a fallback.

**You do not need Vercel (or any separate frontend host).** Render serves the built React app and the API from the same Docker service.

---

## Free-tier notes

- Render free services **sleep after ~15 minutes** of idle traffic; the first request can take ~30–60s
- Atlas free tier is enough for early testing
- Upgrade Render later if you need always-on

---

## Local production build check

```bash
npm ci
npm --prefix frontend ci
npm run build
NODE_ENV=production npm start
```

Then open http://localhost:5000

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| App crash on boot | Check `MONGO` string; Atlas Network Access must allow `0.0.0.0/0` |
| Images fail | Confirm AWS keys + bucket `violetchirag` in `ap-south-1` |
| CORS errors | Set `CORS_ORIGIN` exactly to your Render HTTPS URL |
| Google button missing | Set `GOOGLE_CLIENT_ID`, add the Render URL as a JavaScript origin, then **Clear build cache & deploy** |
| Google button still missing after env set | Hard-refresh `/login` (Ctrl+Shift+R). Confirm the latest deploy finished. |
| Blank white page on `accounts.google.com/gsi/transform` after Google | Deploy the COOP fix (`same-origin-allow-popups`). Confirm Authorized JavaScript origins match the site URL exactly. |
| Health check fails | Ensure `/api/violet/health` returns 200 |
