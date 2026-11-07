import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formatZat, formatRoundedARRR, formatNumber, formatCompactCount, formatCompactARRR, formatCompactSwapTime, safeURL, statsAreValid, swapStatsAreValid, formatClaimTime, privacyCount, calculatorQuery, calculatorDefaultsValid, CALCULATOR_FIELDS, recentMiningPools, poolLastSeen, poolTimingLuck } from '../assets/js/api.js';

test('compact swap values round at unit boundaries and preserve monetary precision', () => {
  assert.equal(formatCompactCount(28900), '29k');
  assert.equal(formatCompactCount(999499), '999k');
  assert.equal(formatCompactCount(999500), '1 M');
  assert.equal(formatCompactCount(0), '0');
  assert.equal(formatCompactARRR('1781578601537302'), '17.8 M');
  assert.equal(formatCompactARRR('99949999999'), '999');
  assert.equal(formatCompactARRR('99950000000'), '1k');
  assert.equal(formatCompactARRR('0'), '0');
  for (const value of [null, undefined, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) assert.equal(formatCompactCount(value), '—');
  for (const value of [null, undefined, '-1', 'invalid', 100]) assert.equal(formatCompactARRR(value), '—');
});

test('compact swap duration rounds into readable time units without invalid zeroes', () => {
  assert.equal(formatCompactSwapTime(550), '9 min');
  assert.equal(formatCompactSwapTime(0), '0s');
  assert.equal(formatCompactSwapTime(59.5), '1 min');
  assert.equal(formatCompactSwapTime(3570), '1 hr');
  assert.equal(formatCompactSwapTime(4500), '1.3 hr');
  assert.equal(formatCompactSwapTime(86400), '1 day');
  for (const value of [null, undefined, -1, NaN, '550']) assert.equal(formatCompactSwapTime(value), '—');
});


test('recent mining pools use last-seen times rather than lifetime block counts, limiting the list to five', () => {
  const pool = (name, last_seen, blocks) => ({ name, last_seen, blocks, address: 'RFBATRxjqGQFuDVhtFFFeTrUgE1WjM57Pa' });
  const source = [pool('Old high count', 100, 999999), pool('Newest', 700, 1), pool('Unknown', null, 8000), pool('Second', 600, 2), pool('Third', 500, 3), pool('Fourth', 400, 4), pool('Fifth', 300, 5)];
  assert.deepEqual(recentMiningPools({ pools: source }).map(p => p.name), ['Newest', 'Second', 'Third', 'Fourth', 'Fifth']);
  assert.equal(source[0].name, 'Old high count');
  assert.equal(poolLastSeen(source[1]), 700000);
  assert.equal(poolLastSeen(source[2]), null);
  assert.deepEqual(recentMiningPools({ pools: [{ name: 'Invalid', address: 'javascript:alert(1)' }] }), []);
  assert.deepEqual(recentMiningPools(null), []);
});

test('pool timing luck preserves zero and leaves unavailable or invalid observations empty', () => {
  assert.equal(poolTimingLuck({ timing_luck_percent: 92.731674 }), 92.731674);
  assert.equal(poolTimingLuck({ timing_luck_percent: 0 }), 0);
  for (const value of [null, '100', -1, NaN, Infinity]) assert.equal(poolTimingLuck({ timing_luck_percent: value }), null);
});

test('calculator accepts every API miner and rejects incomplete defaults', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/mining-calculator-defaults.json', import.meta.url)));
  assert.equal(calculatorDefaultsValid(fixture), true);
  assert.equal(fixture.form.miners.length, 17);
  for (const miner of fixture.form.miners) {
    assert.equal(calculatorDefaultsValid({ ...fixture, inputs: { ...fixture.inputs, miner_id: miner.id } }), true);
  }
  assert.equal(calculatorDefaultsValid({ ...fixture, inputs: { ...fixture.inputs, price_usd: null } }), true);
  assert.equal(calculatorDefaultsValid({ ...fixture, form: { ...fixture.form, miners: [] } }), false);
  assert.equal(calculatorDefaultsValid({ ...fixture, inputs: { ...fixture.inputs, miner_id: 'missing' } }), false);
  assert.equal(calculatorDefaultsValid({ ...fixture, inputs: { ...fixture.inputs, watts: null } }), false);
  assert.equal(calculatorDefaultsValid(null), false);
});

test('calculator sends the complete edited fleet, preserving zero costs and an explicitly cleared quote', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/mining-calculator-defaults.json', import.meta.url)));
  const inputs = { ...fixture.inputs, quantity: 2, watts: 0, electricity_usd_kwh: 0, pool_fee_percent: 0, cost_usd: 0, price_usd: null };
  const query = calculatorQuery(inputs);
  assert.deepEqual([...query.keys()], ['miner_id', ...CALCULATOR_FIELDS]);
  assert.equal(query.get('quantity'), '2');
  for (const key of ['watts', 'electricity_usd_kwh', 'pool_fee_percent', 'cost_usd']) assert.equal(query.get(key), '0');
  assert.equal(query.get('price_usd'), '');
  assert.equal(query.get('sol_s'), String(fixture.inputs.sol_s));
});


test('privacy pool counts retain zero without inventing counts for missing or invalid observations', () => {
  const group = { commitments: { sprout: 602468, sapling: 16734064, ironwood: 0 }, updated_at: '2026-11-06T01:23:19Z' };
  assert.equal(privacyCount(group, 'sprout'), 602468);
  assert.equal(privacyCount(group, 'ironwood'), 0);
  assert.equal(privacyCount(group, 'missing'), null);
  assert.equal(privacyCount({ ...group, updated_at: 'invalid' }, 'sapling'), null);
  for (const value of [-1, 0.5, '10', NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(privacyCount({ ...group, commitments: { sprout: value } }, 'sprout'), null);
  }
  assert.equal(privacyCount(undefined, 'sprout'), null);
});

test('whole ARRR display rounds exactly at half an ARRR without floating-point loss', () => {
  assert.equal(formatRoundedARRR('1781578601000000'), '17,815,786');
  assert.equal(formatRoundedARRR('1781578649999999'), '17,815,786');
  assert.equal(formatRoundedARRR('1781578650000000'), '17,815,787');
  assert.equal(formatRoundedARRR('19899073949999999'), '198,990,739');
  assert.equal(formatRoundedARRR('19899073950000000'), '198,990,740');
  assert.equal(formatRoundedARRR('0'), '0');
  for (const value of [null, undefined, '-1', 'invalid', 100]) assert.equal(formatRoundedARRR(value), '—');
});

test('amounts above JavaScript safe integer preserve exact decimal digits', () => {
  assert.equal(formatZat('19899073963554749', 8), '198,990,739.63554749');
  assert.equal(formatZat('1000000000000000', 0), '10,000,000');
  assert.equal(formatZat('25000000', 3), '0.250');
  assert.equal(formatZat('0', 2), '0.00');
  assert.equal(formatZat(null), '—');
});




test('swap data accepts independent contract outcomes and zero activity, rejecting malformed counts', () => {
  const group = { funded_count: 10, claimed_count: 5, funded_last_30d: 0, pending_count: 1, refunded_count: 1,
    median_claim_seconds: 550, claimed_zat: '1781578601537302', updated_at: '2026-11-05T23:23:21Z' };
  assert.equal(swapStatsAreValid(group), true);
  assert.equal(swapStatsAreValid({ ...group, median_claim_seconds: null }), true);
  for (const value of [-1, 0.5, '10', NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(swapStatsAreValid({ ...group, funded_count: value }), false);
  }
  assert.equal(swapStatsAreValid({ ...group, claimed_zat: 1781578601537302 }), false);
  assert.equal(swapStatsAreValid({ ...group, updated_at: 'invalid' }), false);
  assert.equal(swapStatsAreValid(undefined), false);
});

test('claim timing preserves zero and does not turn missing observations into zero', () => {
  assert.equal(formatClaimTime(550), '9m 10s');
  assert.equal(formatClaimTime(0), '0s');
  assert.equal(formatClaimTime(3661), '1h 1m');
  for (const value of [null, undefined, -1, NaN, '550']) assert.equal(formatClaimTime(value), '—');
});

test('external feed URLs cannot become executable or leave approved hosts', () => {
  assert.equal(safeURL('javascript:alert(1)', ['medium.com']), null);
  assert.equal(safeURL('https://medium.com.evil.test/article', ['medium.com']), null);
  assert.equal(safeURL('https://user:password@medium.com/article', ['medium.com']), null);
  assert.equal(safeURL('https://medium.com/piratechain/article', ['medium.com']), 'https://medium.com/piratechain/article');
  assert.equal(statsAreValid({ network: { height: 10 } }), false);
});


test('homepage validation needs the current network observation, not removed statistic groups', () => {
  const network = { height: 4200000, peer_count: 0, updated_at: '2026-11-06T23:00:00Z' };
  assert.equal(statsAreValid({ network }), true);
  assert.equal(statsAreValid({ network: { ...network, height: 1.5 } }), false);
  assert.equal(statsAreValid({ network: { ...network, updated_at: 'invalid' } }), false);
});
