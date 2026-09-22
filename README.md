# Violet

**Violet** is a handmade-goods marketplace: makers list products, shoppers browse and buy, and sellers manage orders from one place.

It ships as three pieces that share one API:

| Piece | Tech | Role |
| --- | --- | --- |
| **API** | Node.js, Express, MongoDB, JWT, Socket.IO | Auth, catalog, cart, checkout, messages, admin |
| **Web app** | React + Vite + React Router | Browser marketplace UI |
| **Mobile app** | Expo (React Native) | Same features on Android / iOS / Expo web |

Production example: API + built web UI on Render (e.g. `https://violet-hrwi.onrender.com`). Images go to AWS S3. Mobile builds via EAS.

---

## Table of contents

1. [What you can do](#what-you-can-do)
2. [Architecture](#architecture)
3. [Repository layout](#repository-layout)
4. [User flows (start → end)](#user-flows-start--end)
5. [API map](#api-map)
6. [Local development](#local-development)
7. [Environment variables](#environment-variables)
8. [Web app](#web-app)
9. [Mobile app](#mobile-app)
10. [Payments](#payments)
11. [Google OAuth](#google-oauth)
12. [Deploy to production](#deploy-to-production)
13. [Testing](#testing)
14. [Troubleshooting](#troubleshooting)
15. [Further docs](#further-docs)

---

## What you can do

### Shoppers
- Browse the catalog without signing in (guest browse)
- Search, filter by category, sort, paginate
- Open product detail, reviews, seller public shop
- Sign in / register (phone + password) or Continue with Google
- Guest checkout session (limited account for buying)
- Favorites, wishlist (including shared wishlist links)
- Cart, save for later, coupons
- Checkout with **COD**, **UPI**, or **card** (Razorpay / demo)
- Orders: track status, cancel pending payment, mark delivered, request return
- Message sellers, receive notifications

### Sellers
- List products with multiple images (uploaded to S3)
- Manage listings (edit, mark sold, soft-delete)
- Seller dashboard: sales, shipping / tracking, returns, payouts
- Respond to offers and messages

### Admins
- Moderation tools (users, reports, platform overview) via `/admin`

---

## Architecture

```text
┌─────────────────┐     ┌─────────────────┐
│  Web (Vite)     │     │  Mobile (Expo)  │
│  localhost:5173 │     │  Expo Go / APK  │
└────────┬────────┘     └────────┬────────┘
         │  HTTPS / JSON         │
         └──────────┬────────────┘
                    ▼
         ┌──────────────────────┐
         │  Express API :5000   │
         │  /api/violet/...     │
         └──────────┬───────────┘
                    │
     ┌──────────────┼──────────────┐
     ▼              ▼              ▼
 MongoDB        AWS S3         Socket.IO
 (Atlas/local)  (images)       (realtime messages)
```

**Auth model:** JWT in `Authorization: Bearer <token>`. Web stores session in the client auth context; mobile uses Secure Store (or web storage on Expo web).

**Guest vs signed-in:** Guests can open home, catalog, and product pages. Cart, sell, orders, messages, and most account features require auth (web `RequireAuth` / mobile auth modal).

**Production packaging:** One Docker image builds the React SPA and serves it from Express alongside the API. Mobile is a separate Expo project and is not inside that Docker image.

---

## Repository layout

```text
Violet/
├── server.js                 # Express app entry, CORS, health, static SPA
├── package.json              # Root scripts: start, frontend, mobile, test
├── config/
│   ├── config.env.example    # Template for local secrets (copy → config.env)
│   └── db.js                 # Mongoose connection
├── routes/                   # HTTP routers under /api/violet/*
├── models/                   # Mongoose schemas (User, Product, Cart, Order, …)
├── middleware/               # JWT + validation
├── services/                 # Payment helpers (COD / UPI / Razorpay)
├── utils/                    # S3, OTP, realtime, Google auth, currency, …
├── frontend/                 # React + Vite SPA
├── mobile/                   # Expo React Native app
├── docs/                     # Deploy + Google OAuth guides
├── tests/                    # API unit/integration tests
├── e2e/                      # Playwright smoke
├── Dockerfile                # Production: build frontend + run API
├── render.yaml               # Render Blueprint
└── docker-compose.yml        # Optional local compose
```

---

## User flows (start → end)

### A. First visit → browse (guest)

```text
Open site / app
    → Home (marketing) or Shop / Catalog
    → Filter / search products
    → Product detail (images, price, stock, seller link, reviews)
    → Optional: Favorites / message / offer → prompted to sign in
```

**Web routes:** `/`, `/catalog`, `/product/:id`, `/shop/:username`  
**Mobile tabs:** Shop (always available); Cart / Sell / Orders / Account prompt sign-in when logged out

---

### B. Create an account or sign in

```text
Register (username, email, phone, password)
    or Login (country code + phone + password)
    or Continue with Google (ID token → API verifies → JWT)
    or Forgot password → OTP → Reset password
    or Guest checkout (email + phone + address → guest session JWT)
```

**API:** `/api/violet/auth/*`, `/api/violet/guest/session`  
After success, the client stores the JWT and can use protected routes.

---

### C. Buy something (buyer happy path)

```text
1. Browse catalog / product detail
2. Add to cart (auth required)
3. Open Cart → adjust qty, save for later, remove
4. Checkout
      → shipping address (often prefilled from profile)
      → optional coupon validate
      → payment method: COD | UPI | Card
5. Place order
      · COD     → order created, pay on delivery
      · UPI     → “awaiting_upi”; poll payment status / cancel
      · Card    → Razorpay order (or demo confirm when keys/mode allow)
6. Orders list → track status; request return after delivery if needed
```

**API:** `/api/violet/cart`, `/api/violet/orders/checkout`, payment status / cancel / confirm

---

### D. Sell something (seller happy path)

```text
1. Sign in
2. Sell → fill name, detail, price, category, colour, stock
3. Pick photos → upload multipart → stored on S3 → ImageUrls on product
4. Publish → listing appears in catalog (status active)
5. My listings → edit / mark sold / delete (soft)
6. Seller dashboard → ship orders, tracking, resolve returns, payouts
```

**API:** `/api/violet/products` (POST multipart), `/user/:id`, seller stats, order sales endpoints, `/api/violet/payouts`

---

### E. Messages & trust

```text
Product detail → Message seller
    → conversation thread (Socket.IO + REST)
Notifications for orders / messages / offers
Report listing → admin review
Offers: buyer proposes amount → seller sees in Offers
```

---

### F. Admin

```text
User with role=admin → Admin page
    → overview, users, reports / moderation
```

---

## API map

Base path: **`/api/violet`**

| Area | Mount | Examples |
| --- | --- | --- |
| Health | `GET /health` | `{ success, mongo, features }` |
| Auth | `/auth` | register, login, Google, forgot/reset, profile, settings |
| Guest | `/guest` | session |
| Products | `/products` | list, detail, create (images), update, sold, delete |
| Cart | `/cart` | get, items, save-for-later, count |
| Orders | `/orders` | checkout, my orders, pending payment, confirm/cancel, returns |
| Favorites | `/favorites` | list, toggle, status |
| Wishlists | `/wishlists` | personal + shared token |
| Reviews | `/reviews` | list / save by product |
| Messages | `/messages` | conversations, send, unread count |
| Notifications | `/notifications` | list / read |
| Shops | `/shops` | public seller shop by username |
| Coupons | `/coupons` | validate |
| Offers | `/offers` | create / list / respond |
| Payouts | `/payouts` | seller payouts |
| Reports | `/reports` | report product/user |
| Admin | `/admin` | moderation |
| Platform | `/platform` | shared platform config |

Clients: `frontend/src/api.js` and `mobile/src/api.ts` wrap these endpoints.

---

## Local development

### Prerequisites

- Node.js 20+ (22 recommended for Docker parity)
- MongoDB (local or Atlas URI)
- Optional: AWS S3 credentials for image uploads
- Optional: Expo CLI / Expo Go for mobile

### 1. Install

```bash
git clone https://github.com/chiraggoyal11/Violet.git
cd Violet
npm install
npm --prefix frontend install
npm --prefix mobile install
```

### 2. Configure API

```bash
cp config/config.env.example config/config.env
# Edit MONGO, jwtSecret, and optionally S3 / Google / Razorpay
```

Never commit real secrets. Use `config.env.example` as the template.

### 3. Run API + web

```bash
# Terminal 1 — API (default http://127.0.0.1:5000)
npm run dev
# or: npm start

# Terminal 2 — Vite UI (http://localhost:5173)
npm run frontend
```

In production-style local check:

```bash
npm run build
NODE_ENV=production npm start
# open http://localhost:5000  (API serves built SPA)
```

### 4. Run mobile

```bash
# Point at your API (required on a physical phone)
export EXPO_PUBLIC_API_URL=http://192.168.x.x:5000   # LAN IP of your machine
# Android emulator: http://10.0.2.2:5000
# iOS sim / same machine: http://127.0.0.1:5000

npm run mobile
# or: cd mobile && npm start
#     cd mobile && npm run web
```

EAS Android APK (preview):

```bash
cd mobile
npx eas-cli login
npx eas-cli build -p android --profile preview
```

`mobile/eas.json` sets `EXPO_PUBLIC_API_URL` to the production Render host for preview/production builds. `app.json` → `extra.apiUrl` is a fallback.

---

## Environment variables

Copy from `config/config.env.example`. Important keys:

| Variable | Purpose |
| --- | --- |
| `PORT` | API port (default `5000`) |
| `MONGO` | MongoDB connection string |
| `jwtSecret` | JWT signing secret |
| `CORS_ORIGIN` | Allowed browser origins (comma-separated). Localhost / LAN are also allowed for Expo web smoke tests |
| `GOOGLE_CLIENT_ID` | Google OAuth Web Client ID |
| `BUCKET_NAME` / `BUCKET_REGION` | S3 bucket |
| `ACCESS_KEY` / `SECRET_ACCESS_KEY` | S3 IAM keys |
| `S3_ENDPOINT` | Only for MinIO / non-AWS S3-compatible stores |
| `PAYMENT_MODE` | `demo` or `razorpay` |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Live/test Razorpay |
| `RESET_DEV_MODE` / `RESET_RETURN_OTP` | Expose OTP in responses when SMS is not configured (dev only) |

**Frontend (local Google button):** `frontend/.env` → `VITE_GOOGLE_CLIENT_ID` (same Client ID).

**Mobile:** `EXPO_PUBLIC_API_URL` (build-time / runtime public env).

---

## Web app

- **Stack:** React, Vite, React Router, shared `AuthContext`
- **Entry:** `frontend/src/main.jsx` → `App.jsx`
- **Chrome:** Header + BottomNav for signed-in users; marketing home stays chrome-light for guests
- **Auth gate:** `RequireAuth` wraps cart, checkout, sell, orders, messages, etc.
- **API client:** `frontend/src/api.js` (proxied / same-origin in production Docker)

### Main pages

| Path | Page |
| --- | --- |
| `/` | Home |
| `/catalog` | Shop catalog |
| `/product/:id` | Product detail |
| `/shop/:username` | Public seller shop |
| `/login` `/register` | Auth |
| `/guest-checkout` | Guest session |
| `/cart` `/checkout` `/orders` | Buy flow |
| `/sell` `/mine` `/seller` | Sell flow |
| `/favorites` `/wishlist` `/w/:token` | Saves |
| `/messages` `/notifications` | Inbox |
| `/profile` `/settings` | Account |
| `/admin` | Admin |

---

## Mobile app

- **Stack:** Expo SDK ~57, React Navigation (tabs + stacks), Expo Secure Store
- **Entry:** `mobile/App.tsx` → `RootNavigator`
- **Tabs:** Shop · Sell · Cart · Orders · Account
- **Guest UX:** Main tabs always mount; auth opens as a **modal**. Cart/Sell/Orders/Account use `RequireAuth` with Sign in / Create account / Guest
- **Config:** `mobile/src/config.ts` resolves `EXPO_PUBLIC_API_URL` → `app.json` `extra.apiUrl` → production Render URL
- **Parity:** Closely mirrors web (shop, PDP, cart, checkout COD/UPI/card, orders, sell, messages, favorites, wishlist, offers, admin)

See `mobile/README.md` for device-specific API URL tips.

---

## Payments

Implemented in `services/payment.js` and `/api/violet/orders`.

| Method | Behavior |
| --- | --- |
| **COD** | Order created immediately; pay on delivery |
| **UPI** | Collect request; client polls payment status; cancel restores cart items |
| **Card** | Razorpay order when keys + mode are set; otherwise demo confirm path for local/testing |

Pending payments expire (UPI timeout). Checkout validates address (including 6-digit pincode) and payment fields (UPI VPA, card number/expiry/CVV formatting).

---

## Google OAuth

1. Create a Google Cloud **OAuth Web Client**
2. Add Authorized JavaScript origins (local Vite + production Render URL)
3. Set `GOOGLE_CLIENT_ID` on the API (and `VITE_GOOGLE_CLIENT_ID` for local frontend)
4. User clicks **Continue with Google** → ID token → `POST /api/violet/auth/google` → JWT

Full steps: [`docs/google-oauth.md`](docs/google-oauth.md).

---

## Deploy to production

Recommended path: **Render (Docker) + MongoDB Atlas + AWS S3**.

```text
Browser ──► https://YOUR-APP.onrender.com
               │
               ├── Express API + built React SPA
               ├── MongoDB Atlas
               └── AWS S3 (product images)
```

1. Create Atlas cluster + DB user + network access `0.0.0.0/0`
2. Deploy via Render Blueprint (`render.yaml`) or Docker web service
3. Set env vars (`MONGO`, `jwtSecret`, S3 keys, optional `GOOGLE_CLIENT_ID`)
4. After first URL is known, set `CORS_ORIGIN` to that HTTPS origin and redeploy
5. Health check: `GET /api/violet/health`

Detailed checklist: [`docs/deploy.md`](docs/deploy.md).

**Mobile production:** EAS Build (`mobile/eas.json` preview → APK). Install the APK from the Expo dashboard artifact link. Rebuild after mobile code changes.

---

## Testing

```bash
# API tests (Node test runner + Supertest)
npm test

# Playwright e2e smoke (needs app running)
npm run test:e2e
```

Tests live under `tests/` (`api.test.js`, `features18.test.js`, `cardInput.test.mjs`) and `e2e/smoke.spec.js`.

---

## Troubleshooting

| Symptom | Likely fix |
| --- | --- |
| Health `"mongo": false` | Fix Atlas URI / Network Access; restart API |
| Web shop empty / CORS errors from Expo web | Set `CORS_ORIGIN`; localhost is allowed for local Expo ports |
| Mobile blank / cannot reach API | Set `EXPO_PUBLIC_API_URL` to a reachable host (not `127.0.0.1` on a physical phone) |
| Images fail to upload | Check S3 bucket, region, IAM keys; do not set `S3_ENDPOINT` for real AWS |
| Google button missing | Set Client ID, add JS origin, clear Render build cache & redeploy |
| Login wall on old mobile APK | Rebuild EAS preview after guest-browse navigation changes |
| Catalog shows letter placeholders | Products have empty `ImageUrls` — listing data, not a broken client |
| Render cold start 502 | Free tier sleeps; wait ~30–60s and retry |

---

## Further docs

| Doc | Contents |
| --- | --- |
| [`docs/deploy.md`](docs/deploy.md) | Render + Atlas + S3 production guide |
| [`docs/google-oauth.md`](docs/google-oauth.md) | Google sign-in setup |
| [`mobile/README.md`](mobile/README.md) | Expo setup, features, EAS notes |

---

## Scripts (root)

| Script | Command |
| --- | --- |
| `npm start` | Run API |
| `npm run dev` | API with nodemon |
| `npm run frontend` | Vite dev server |
| `npm run mobile` | Expo start |
| `npm run build` | Build frontend into `frontend/dist` |
| `npm test` | API tests |
| `npm run test:e2e` | Playwright |

---

## License

See repository license files (mobile includes Expo template LICENSE). Project package license field: ISC.
