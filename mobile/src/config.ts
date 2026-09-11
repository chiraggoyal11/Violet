/**
 * Violet mobile app configuration.
 *
 * Set EXPO_PUBLIC_API_URL to your API origin, e.g.:
 *   http://192.168.1.10:5000   (device on same Wi‑Fi)
 *   https://your-violet.onrender.com
 *
 * Android emulator can use http://10.0.2.2:5000 for host machine localhost.
 * iOS simulator can use http://127.0.0.1:5000.
 */
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ||
  'http://127.0.0.1:5000'
).replace(/\/$/, '');

export const APP_NAME = 'Violet';
