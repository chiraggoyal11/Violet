import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCardNumberInput,
  formatCardExpiryInput,
  formatCvvInput,
} from '../frontend/src/utils/cardInput.js';

describe('card input formatting', () => {
  it('limits card number to 16 digits and groups by 4', () => {
    assert.equal(formatCardNumberInput('4111111111111111'), '4111 1111 1111 1111');
    assert.equal(formatCardNumberInput('4111-1111-1111-11112222'), '4111 1111 1111 1111');
    assert.equal(formatCardNumberInput('abcd4111'), '4111');
  });

  it('auto-inserts slash in expiry (1226 → 12/26)', () => {
    assert.equal(formatCardExpiryInput('12'), '12');
    assert.equal(formatCardExpiryInput('122'), '12/2');
    assert.equal(formatCardExpiryInput('1226'), '12/26');
    assert.equal(formatCardExpiryInput('12/26'), '12/26');
    assert.equal(formatCardExpiryInput('122699'), '12/26');
  });

  it('limits CVV to 3 digits', () => {
    assert.equal(formatCvvInput('12'), '12');
    assert.equal(formatCvvInput('1234'), '123');
    assert.equal(formatCvvInput('12a3b'), '123');
  });
});
