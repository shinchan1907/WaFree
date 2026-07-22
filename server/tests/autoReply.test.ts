import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesKeywords } from '../src/automation/autoReply.js';

test('matches when trigger_type is all regardless of text', () => {
  assert.equal(matchesKeywords({ trigger_type: 'all', keywords: null, match_mode: 'contains' }, 'anything'), true);
});

test('contains mode matches keyword anywhere, case-insensitive', () => {
  const rule = { trigger_type: 'keyword' as const, keywords: 'price, cost', match_mode: 'contains' as const };
  assert.equal(matchesKeywords(rule, 'What is the PRICE of this?'), true);
  assert.equal(matchesKeywords(rule, 'how much does it cost?'), true);
  assert.equal(matchesKeywords(rule, 'hello there'), false);
});

test('exact mode requires the whole message to equal a keyword', () => {
  const rule = { trigger_type: 'keyword' as const, keywords: 'hi', match_mode: 'exact' as const };
  assert.equal(matchesKeywords(rule, 'hi'), true);
  assert.equal(matchesKeywords(rule, '  HI  '), true);
  assert.equal(matchesKeywords(rule, 'hi there'), false);
});

test('starts mode matches only message prefixes', () => {
  const rule = { trigger_type: 'keyword' as const, keywords: 'order', match_mode: 'starts' as const };
  assert.equal(matchesKeywords(rule, 'Order #123 status?'), true);
  assert.equal(matchesKeywords(rule, 'my order is late'), false);
});

test('returns false for keyword rules with empty keyword list', () => {
  assert.equal(
    matchesKeywords({ trigger_type: 'keyword', keywords: ' , ,', match_mode: 'contains' }, 'anything'),
    false
  );
});
