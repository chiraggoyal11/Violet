# Deploying Violet to AWS

This guide covers a production deployment using **AWS S3** (product images), **EC2 or ECS** (API + built frontend), and **CloudFront** (CDN + HTTPS).

## Architecture

```
Browser ──► CloudFront (HTTPS)
              ├── /* static assets → S3 origin (frontend/dist) OR EC2
              └── /api/* → ALB → EC2/ECS (Node on :5000)
MongoDB Atlas ──► API
AWS S3 (violetchirag) ──► signed product image URLs from API
```

## 1. Prerequisites

- MongoDB Atlas cluster (or self-hosted MongoDB)
- S3 bucket for product images (e.g. `violetchirag` in `ap-south-1`)
- IAM user with `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on that bucket
- Domain name (optional but recommended for CloudFront)

## 2. Environment variables

Copy `config/config.env.example` to `config/config.env` on the server (or use your host's secrets UI):

```env
PORT=5000
MONGO=mongodb+srv://USER:PASS@cluster.mongodb.net/violet
jwtSecret=<long-random-string>
CORS_ORIGIN=https://your-domain.com

BUCKET_NAME=violetchirag
BUCKET_REGION=ap-south-1
ACCESS_KEY=AKIA...
SECRET_ACCESS_KEY=...

# Do NOT set S3_ENDPOINT for real AWS
NODE_ENV=production
```

## 3. Build and run on EC2

```bash
git clone https://github.com/chiraggoyal11/Violet.git
cd Violet
npm ci
npm --prefix frontend ci
npm run build
npm start
```

Use **PM2** or **systemd** to keep the process alive:

```bash
npm install -g pm2
pm2 start server.js --name violet
pm2 save
```

Open port **5000** (or put nginx in front on 443).

## 4. CloudFront setup

### Option A — Single origin (simplest)

1. Point CloudFront origin to your EC2 public DNS / ALB.
2. Default behavior: forward all paths to Node.
3. Node already serves `frontend/dist` when built (`npm run build`).
4. Add ACM certificate in **us-east-1** for your custom domain.
5. Set alternate domain name (CNAME) on the distribution.

### Option B — Split static + API (recommended at scale)

| Behavior | Path pattern | Origin |
|----------|--------------|--------|
| Default | `Default (*)` | S3 bucket with `frontend/dist` |
| API | `/api/*` | ALB → Node :5000 |

Steps:

1. Upload `frontend/dist` to a **separate** S3 bucket (static site).
2. Create CloudFront distribution with S3 as default origin.
3. Add second origin: Application Load Balancer → EC2/ECS.
4. Add cache behavior: path `/api/*` → ALB origin, **CachingDisabled** managed policy.
5. Forward headers: `Authorization`, `Content-Type`.
6. Set `CORS_ORIGIN` to your CloudFront URL or custom domain.

## 5. Product images (existing bucket)

Product uploads use **presigned URLs** from the API. The bucket `violetchirag` stays private; only the API signs temporary GET URLs.

Ensure bucket CORS allows your site origin if you ever switch to direct browser uploads:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedOrigins": ["https://your-domain.com"],
    "ExposeHeaders": []
  }
]
```

## 6. Docker (alternative)

```bash
docker compose up -d --build
```

Set env vars in `docker-compose.yml` or an `.env` file. Expose port 5000 behind a reverse proxy.

## 7. CI / health checks

- GitHub Actions runs API tests + frontend build on every push.
- After deploy, verify:
  - `GET /api/violet/products` returns JSON
  - Register → list product with image → signed URL loads in browser

## 8. Password reset in production

OTP codes are logged to the server console when `RESET_DEV_MODE=true` or `NODE_ENV=development`. In production, integrate SMS (Twilio) or email (SES) in `utils/otp.js` — the API routes are already in place.

## Quick checklist

- [ ] MongoDB reachable from server
- [ ] S3 bucket + IAM keys in secrets
- [ ] `npm run build` before `npm start`
- [ ] CloudFront HTTPS + custom domain
- [ ] `CORS_ORIGIN` matches public URL
- [ ] `jwtSecret` is strong and secret
