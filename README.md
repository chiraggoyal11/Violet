# Violet

Handmade goods marketplace with an Express/MongoDB API and a React (Vite) frontend.

## Features

- Auth (JWT), profile edit
- Product catalog with search, category/price filters, sort, pagination
- Soft-delete listings, sold badge, stock, categories
- Favorites / wishlist
- Cart + checkout + order history
- Reviews & ratings
- Seller dashboard (stats + sales)
- AWS S3 image uploads (browser-side compress)
- Helmet + rate limiting

## Stack

- **Backend:** Node.js, Express, Mongoose, JWT
- **Object storage:** AWS S3 (or MinIO via `S3_ENDPOINT`)
- **Frontend:** React + Vite + React Router
- **Database:** MongoDB

## Object storage (AWS S3)

| Variable | Meaning |
| --- | --- |
| `BUCKET_NAME` | Your S3 bucket name |
| `BUCKET_REGION` | e.g. `ap-south-1` (region code only) |
| `ACCESS_KEY` | IAM access key id |
| `SECRET_ACCESS_KEY` | IAM secret |

Do **not** set `S3_ENDPOINT` for real AWS.

## Quick start

```bash
npm install
npm --prefix frontend install
cp config/config.env.example config/config.env
# Edit config/config.env with Mongo + AWS keys

npm start
npm run frontend
```

UI: http://localhost:5173 · API: http://localhost:5000

## Tests

```bash
npm test
```
