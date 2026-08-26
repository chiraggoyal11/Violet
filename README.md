# Violet

Handmade goods marketplace with an Express/MongoDB API and a React (Vite) frontend.

## Stack

- **Backend:** Node.js, Express, Mongoose, JWT auth
- **Object storage:** MinIO locally (S3-compatible) or AWS S3 in production
- **Frontend:** React + Vite + React Router (`frontend/`)
- **Database:** MongoDB

## Quick start

```bash
# 1. Install dependencies (+ MongoDB/MinIO binaries via Cloud Agent scripts)
npm install
npm --prefix frontend install
cp config/config.env.example config/config.env

# 2. Start MongoDB + MinIO (or: bash .cursor/start.sh)
# 3. Run the apps
npm start                 # API on http://localhost:5000
npm run frontend          # UI on http://localhost:5173
```

The Vite dev server proxies `/api` to the Express API.

Default local object storage (from `config/config.env.example`):

| Setting | Value |
| --- | --- |
| `S3_ENDPOINT` | `http://127.0.0.1:9000` (MinIO) |
| `BUCKET_NAME` | `violet-products` |
| `ACCESS_KEY` / `SECRET_ACCESS_KEY` | `minioadmin` / `minioadmin` |

For **real AWS S3**, remove `S3_ENDPOINT` and set IAM access keys + bucket/region.

## Production

```bash
npm run build             # builds frontend/dist
npm start                 # Express serves API + the built UI on PORT
```

Or with Docker (requires `config/config.env` mounted or env vars; point `S3_ENDPOINT` at a reachable MinIO/AWS):

```bash
docker build -t violet .
docker run --rm -p 5000:5000 --env-file config/config.env violet
```

## Tests

```bash
# MongoDB + MinIO must be running
npm test
```

## API

| Area | Base path |
| --- | --- |
| Auth / profile | `/api/violet/auth` |
| Products | `/api/violet/products` |

Product create/update/delete require `Authorization: Bearer <token>`.
Product images upload to S3-compatible storage when configured.

## Frontend routes

| Path | Purpose |
| --- | --- |
| `/` | Branded landing |
| `/catalog` | Browse / search / paginate |
| `/product/:id` | Product detail |
| `/login`, `/register` | Auth |
| `/sell` | Create a listing |
| `/mine` | Edit / remove your listings |
| `/profile` | Edit display name |
