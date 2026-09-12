/**
 * Violet mobile app configuration.
 *
 * Prefer EXPO_PUBLIC_API_URL (EAS build env / local export).
 * Falls back to app.json extra.apiUrl, then the public Render API.
 */
import Constants from 'expo-constants';

const extraUrl = Constants.expoConfig?.extra?.apiUrl;
const fromExtra =
  typeof extraUrl === 'string' &&
  extraUrl &&
  !extraUrl.includes('${') &&
  extraUrl.startsWith('http')
    ? extraUrl
    : '';

export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ||
  fromExtra ||
  'https://violet-hrwi.onrender.com'
).replace(/\/$/, '');

export const APP_NAME = 'Violet';
