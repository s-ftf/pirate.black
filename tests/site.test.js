import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { walletBookmark } from '../assets/js/site.js';

test('wallet bookmarks resolve only the three core-wallet sections, including encoded links', () => {
  for (const id of ['treasure-chest', 'paper-wallet', 'cli-wallet']) assert.equal(walletBookmark(`#${id}`), id);
  assert.equal(walletBookmark('#paper%2Dwallet'), 'paper-wallet');
  for (const value of ['', '#wallets', '#stashi', '#unknown', '#__proto__', '#%E0%A4%A']) assert.equal(walletBookmark(value), null);
});
