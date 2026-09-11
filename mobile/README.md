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

From the repo root:

```bash
npm run mobile
```

## Run

```bash
npm start
# or: npm run web   (browser smoke test)
```

## Features (parity with web)

**Auth:** phone login/register, forgot/reset password, guest checkout session

**Buy:** shop search + categories, product detail, favorites, wishlist, reviews, offers, report listing, message seller, public shop page

**Cart / checkout:** qty edits, save for later, coupons, COD + UPI + card (demo/Razorpay confirm), pending payment resume/cancel

**Orders:** list, cancel pending payment, mark delivered, request return

**Sell:** create listing (multi-image), my listings (edit/sold/delete), seller dashboard (ship/tracking, resolve returns, payouts)

**Account:** edit profile, settings, notifications, offers inbox, messages, admin moderation (admin role)

## Notes

- Native Razorpay Checkout UI is not embedded; card flows use the API confirm path (same demo mode as web when keys are absent).
- Push notification device registration is settings-ready; Expo push tokens can be wired later.
