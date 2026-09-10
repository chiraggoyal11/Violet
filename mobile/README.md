# Violet mobile (Expo)

React Native app for the Violet handmade marketplace. Talks to the same Express API as the web app (`/api/violet/...`).

## Requirements

- Node 20+
- Expo Go on a phone, or an iOS Simulator / Android Emulator
- Violet API running (default `http://127.0.0.1:5000`)

## Setup

```bash
cd mobile
npm install
```

Set the API origin (required on a physical device):

```bash
# iOS simulator / Expo web on same machine
export EXPO_PUBLIC_API_URL=http://127.0.0.1:5000

# Android emulator
export EXPO_PUBLIC_API_URL=http://10.0.2.2:5000

# Physical device on the same Wi‑Fi (use your computer’s LAN IP)
export EXPO_PUBLIC_API_URL=http://192.168.x.x:5000
```

From the repo root you can also run:

```bash
npm run mobile
```

## Run

```bash
npx expo start
```

Then press `i` / `a`, or scan the QR code with Expo Go.

## What’s included (v1)

- Phone + password sign-in / register (SecureStore session)
- Shop browse + category chips + product detail
- Cart + COD checkout
- Orders list
- Messages inbox + thread
- Profile + API URL display

UPI/card checkout, listing creation, and push notifications are not in this first mobile cut — use the web app for those.
