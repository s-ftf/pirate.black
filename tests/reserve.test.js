import test from 'node:test';
import assert from 'node:assert/strict';
import { reserveSupplyIsValid, reserveCoverage, reserveComparison } from '../assets/js/api.js';

test('reserve comparison detects differences smaller than the displayed precision', () => {
  assert.equal(reserveComparison('1000000000000000'), 'matched');
  assert.equal(reserveComparison('999999999999999'), 'below');
  assert.equal(reserveComparison('1000000000000001'), 'above');
  assert.equal(reserveComparison('0'), 'below');
  assert.equal(reserveComparison('invalid'), 'waiting');
});

test('reserve coverage keeps exact zatoshi precision and valid zero', () => {
  assert.equal(reserveCoverage('1000000000000000'), '100%');
  assert.equal(reserveCoverage('973549999999999'), '97.35%');
  assert.equal(reserveCoverage('973550000000000'), '97.36%');
  assert.equal(reserveCoverage('0'), '0%');
  assert.equal(reserveCoverage('2000000000000000'), '200%');
  for (const value of [undefined, null, -1, 'invalid', '-1']) assert.equal(reserveCoverage(value), '—');
});

test('reserve supply rejects missing, numeric, malformed, and future data', () => {
  const now = Date.parse('2026-11-06T23:00:00Z');
  const data = { varrr_locked_zat: '1000000000000000', updated_at: '2026-11-06T22:59:00Z' };
  assert.equal(reserveSupplyIsValid(data, now), true);
  assert.equal(reserveSupplyIsValid({ ...data, varrr_locked_zat: '0' }, now), true);
  for (const value of [null, {}, { ...data, varrr_locked_zat: 1000000000000000 }, { ...data, varrr_locked_zat: '-1' }, { ...data, updated_at: 'invalid' }, { ...data, updated_at: '2026-11-06T23:03:00Z' }]) assert.equal(reserveSupplyIsValid(value, now), false);
});
