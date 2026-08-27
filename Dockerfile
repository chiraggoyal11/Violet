FROM node:22-bookworm-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Bake Google Client ID into the SPA so the button works even when the
# API is cold-starting (Render free tier 502s). Render injects service
# env vars during docker build; prefer explicit VITE_ override if set.
ARG VITE_GOOGLE_CLIENT_ID=
ARG GOOGLE_CLIENT_ID=
ENV VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}
ENV GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
RUN VITE_GOOGLE_CLIENT_ID="${VITE_GOOGLE_CLIENT_ID:-$GOOGLE_CLIENT_ID}" npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
COPY --from=frontend-build /app/frontend/dist ./frontend/dist
EXPOSE 5000
CMD ["node", "server.js"]
