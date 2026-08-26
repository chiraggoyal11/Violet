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

# 2. Create config/config.env (gitignored) — see .cursor/install.sh for a template
# 3. Start MongoDB locally, then:

npm start                 # API on http://localhost:5000
npm run frontend          # UI on http://localhost:5173
```

The Vite dev server proxies `/api` to the Express API.

## Frontend routes

| Path | Purpose |
| --- | --- |
| `/` | Branded landing |
| `/catalog` | Browse / search products |
| `/login`, `/register` | Auth |
| `/sell` | Create a listing (signed in) |
| `/mine` | Manage your listings |

## API

All routes are under `/api/violet/auth` (register, login, product CRUD).
