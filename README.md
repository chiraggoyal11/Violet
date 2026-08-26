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

Product create/update/delete require a JWT (`Authorization: Bearer <token>`).
Image upload is optional and only works when real AWS S3 credentials are set.

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
