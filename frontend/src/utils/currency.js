/** Display-only FX helpers. Amounts on the API are INR. */

const FALLBACK_RATES = {
  INR: 1,
  USD: 0.012,
  EUR: 0.011,
};

let cachedRates = { ...FALLBACK_RATES };
let cacheLoadedAt = 0;

export function setCurrencyRates(rates) {
  if (!rates || typeof rates !== 'object') return;
  cachedRates = { ...FALLBACK_RATES, ...rates };
  cacheLoadedAt = Date.now();
}

export function getCachedRates() {
  return { ...cachedRates, _loadedAt: cacheLoadedAt };
}

export function convertFromInr(amountInr, currency = 'INR') {
  const n = Number(amountInr);
  if (!Number.isFinite(n)) return null;
  const rate = cachedRates[currency] || FALLBACK_RATES[currency] || 1;
  return Number((n * rate).toFixed(2));
}

export function formatMoney(amountInr, currency = 'INR') {
  const converted = convertFromInr(amountInr, currency);
  if (converted == null) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(converted);
  } catch {
    return `${currency} ${converted.toFixed(2)}`;
  }
}
