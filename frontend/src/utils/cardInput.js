/** Digits only, max 16, grouped as 4111 1111 1111 1111. */
export function formatCardNumberInput(value) {
  const digits = String(value || '')
    .replace(/\D/g, '')
    .slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

/** Digits only → MM/YY (typing 1226 becomes 12/26). */
export function formatCardExpiryInput(value) {
  const digits = String(value || '')
    .replace(/\D/g, '')
    .slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

/** Digits only, max 3. */
export function formatCvvInput(value) {
  return String(value || '')
    .replace(/\D/g, '')
    .slice(0, 3);
}
