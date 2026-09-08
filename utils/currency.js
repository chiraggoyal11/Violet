/** Approximate FX rates vs INR for display-only conversion. */
const RATES_FROM_INR = {
  INR: 1,
  USD: 0.012,
  EUR: 0.011,
};

function convertFromInr(amountInr, currency = 'INR') {
  const n = Number(amountInr);
  if (!Number.isFinite(n)) return null;
  const rate = RATES_FROM_INR[currency] || 1;
  return Number((n * rate).toFixed(currency === 'INR' ? 2 : 2));
}

function formatMoney(amountInr, currency = 'INR') {
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

function getRates() {
  return { base: 'INR', rates: { ...RATES_FROM_INR }, updatedAt: new Date().toISOString() };
}

module.exports = {
  RATES_FROM_INR,
  convertFromInr,
  formatMoney,
  getRates,
};
