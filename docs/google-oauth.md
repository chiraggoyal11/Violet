# Google OAuth setup

Violet supports **Continue with Google** on the login and register pages.

## 1. Create Google OAuth credentials

1. Open [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Create an **OAuth 2.0 Client ID** (Web application)
3. Add **Authorized JavaScript origins**:
   - `http://localhost:5173` (Vite local)
   - `http://localhost:5000` (production build locally)
   - Your production URL (e.g. `https://violet-hrwi.onrender.com`) — no trailing slash
4. Copy the **Client ID** (ends with `.apps.googleusercontent.com`)

No client secret is required for the ID-token flow used by Violet.

## 2. Configure the API

In `config/config.env`:

```env
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
```

## 3. Configure the frontend

### Local development

Create `frontend/.env`:

```env
VITE_GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
```

Use the **same Client ID** as the API.

### Production (Render Docker)

Set `GOOGLE_CLIENT_ID` on the Render service, then **Clear build cache & deploy**.
The Dockerfile bakes that value into the SPA automatically — no separate frontend host (e.g. Vercel) is required.

Restart both servers after changing local env files.

## 4. Production notes (Render)

The API sets `Cross-Origin-Opener-Policy: same-origin-allow-popups` so the Google
popup can return the ID token. A stricter `same-origin` COOP leaves a blank
`accounts.google.com/gsi/transform` page after choosing a Google account.

Authorized JavaScript origins must include your exact Render URL
(e.g. `https://violet-hrwi.onrender.com`) — no trailing slash.

## 5. How it works

- User clicks **Continue with Google** on login or register
- Google returns an ID token to the browser
- Violet API verifies the token with Google and creates or links the account
- API returns the same JWT used for phone/password login

## Account linking

If a user already registered with the same email via phone/password, signing in with Google links the Google account to that profile.

## Cursor Cloud Agents

Add `GOOGLE_CLIENT_ID` to environment secrets and set `VITE_GOOGLE_CLIENT_ID` in the frontend build environment (or `frontend/.env`).
