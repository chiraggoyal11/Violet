# Violet

Handmade goods marketplace with an Express/MongoDB API and a React (Vite) frontend.

## Stack

- **Backend:** Node.js, Express, Mongoose, JWT auth, optional AWS S3 images
- **Frontend:** React + Vite + React Router (`frontend/`)
- **Database:** MongoDB

## Quick start

```bash
# 1. Install dependencies
npm install
npm --prefix frontend install

# 2. Copy env template and edit secrets
cp config/config.env.example config/config.env

# 3. Start MongoDB locally, then:
npm start                 # API on http://localhost:5000
npm run frontend          # UI on http://localhost:5173
```

The Vite dev server proxies `/api` to the Express API.

## Production

```bash
npm run build             # builds frontend/dist
npm start                 # Express serves API + the built UI on PORT
```

Or with Docker (requires `config/config.env` mounted or env vars):

```bash
docker build -t violet .
docker run --rm -p 5000:5000 --env-file config/config.env violet
```

## Tests

```bash
# MongoDB must be running
npm test
```

## API

| Area | Base path |
| --- | --- |
| Auth / profile | `/api/violet/auth` |
| Products | `/api/violet/products` |

Product create/update/delete require `Authorization: Bearer <token>`.
Image upload is optional and only works with real AWS S3 credentials.

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
