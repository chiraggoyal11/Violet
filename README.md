# Violet

Handmade goods marketplace with an Express/MongoDB API and a React (Vite) frontend.

## Stack

- **Backend:** Node.js, Express, Mongoose, JWT auth
- **Object storage:** MinIO locally (S3-compatible) or AWS S3 in production
- **Frontend:** React + Vite + React Router (`frontend/`)
- **Database:** MongoDB

## Object storage (AWS S3)

Use **real AWS S3** by setting these in `config/config.env` (gitignored) or as environment secrets:

| Variable | Meaning |
| --- | --- |
| `BUCKET_NAME` | Your S3 bucket name |
| `BUCKET_REGION` | e.g. `us-east-1` |
| `ACCESS_KEY` | IAM access key id (or `AWS_ACCESS_KEY_ID`) |
| `SECRET_ACCESS_KEY` | IAM secret (or `AWS_SECRET_ACCESS_KEY`) |

Do **not** set `S3_ENDPOINT` for real AWS.

IAM needs at least: `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:ListBucket` on that bucket.

Optional local fallback: MinIO via `S3_ENDPOINT=http://127.0.0.1:9000` (see comments in `config/config.env.example`).

## Quick start

```bash
npm install
npm --prefix frontend install
cp config/config.env.example config/config.env
# Edit config/config.env with Mongo URL + AWS keys + bucket

npm start                 # API on http://localhost:5000
npm run frontend          # UI on http://localhost:5173
```

The Vite dev server proxies `/api` to the Express API.

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
