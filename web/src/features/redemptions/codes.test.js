import test from 'node:test';
import assert from 'node:assert/strict';
import { codesURL, codeStatus, serializeRedemptionDraft, redemptionPageSchema } from './codes.ts';

test('redemption search preserves status, keyword escaping, and pagination', () => {
  const url = new URL(codesURL({ keyword: ' A&B+1 ', status: 'expired' }, 3), 'https://example.test');
  assert.equal(url.pathname, '/api/redemption/search');
  assert.equal(url.searchParams.get('keyword'), 'A&B+1');
  assert.equal(url.searchParams.get('status'), 'expired');
  assert.equal(url.searchParams.get('p'), '3');
  assert.equal(new URL(codesURL({ keyword: '', status: '1' }, 1), url).pathname, '/api/redemption/search');
  assert.equal(new URL(codesURL({ keyword: '', status: '' }, 1), url).pathname, '/api/redemption/');
});

test('quota code drafts preserve explicit positive amounts and whole batch counts', () => {
  const draft = { name: '  credit  ', amount: 1, count: 2, expiry: '', badExpiry: false };
  const toQuota = (amount) => Math.round(amount * 500000);
  assert.deepEqual(serializeRedemptionDraft(draft, toQuota), { name: 'credit', quota: 500000, count: 2, expired_time: 0 });
  for (const amount of ['', 0, -1, 1e-9, Infinity, NaN]) assert.equal(serializeRedemptionDraft({ ...draft, amount }, toQuota), null);
  for (const count of ['', 0, -1, 1.5, 101]) assert.equal(serializeRedemptionDraft({ ...draft, count }, toQuota), null);
});

test('quota code drafts reject invalid dates, expired dates and native incomplete inputs', () => {
  const draft = { name: '', amount: 1, count: 1, expiry: '', badExpiry: false };
  for (const patch of [{ expiry: 'invalid' }, { expiry: '2000-01-01T00:00' }, { badExpiry: true }, { name: '名'.repeat(21) }]) assert.equal(serializeRedemptionDraft({ ...draft, ...patch }, (amount) => amount), null);
  assert.equal(serializeRedemptionDraft({ ...draft, expiry: '2099-01-01T00:00' }, (amount) => amount).quota, 1);
});

test('quota code pages reject unsafe financial values and malformed lists', () => {
  const code = { id: 1, key: 'key', name: '', quota: 10, status: 1, used_user_id: 0, created_time: 0, expired_time: 0 };
  assert.equal(redemptionPageSchema.parse({ total: 1, items: [code] }).items[0].quota, 10);
  for (const patch of [{ quota: -1 }, { quota: 9007199254740992 }, { status: 99 }, { key: '' }]) assert.equal(redemptionPageSchema.safeParse({ total: 1, items: [{ ...code, ...patch }] }).success, false);
  assert.equal(redemptionPageSchema.safeParse({ total: -1, items: [] }).success, false);
  assert.equal(redemptionPageSchema.safeParse({ total: 1, items: {} }).success, false);
});

test('expired display does not override already used or disabled codes', () => {
  const code = { status: 1, expired_time: 100 };
  assert.equal(codeStatus(code, 101), 'expired');
  assert.equal(codeStatus(code, 100), '1');
  assert.equal(codeStatus({ ...code, status: 2 }, 101), '2');
  assert.equal(codeStatus({ ...code, status: 3 }, 101), '3');
  assert.equal(codeStatus({ ...code, expired_time: 0 }, 101), '1');
});
