import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTestModules } from '../../../scripts/load-test-modules.mjs';
const { entry0: { parseConsoleDraft, parseApiInfo, parseFAQ, invalidConsoleContentChanges } } = await loadTestModules(['./src/features/dashboard-content/content.ts']);

test('console content keeps repairable drafts and excludes unsafe API addresses from display', () => {
  const valid = { url: 'https://api.example.com/v1', route: 'Global', description: 'Primary', color: 'blue' };
  assert.equal(parseConsoleDraft('api_info', JSON.stringify([valid])).valid, true);
  const blank = parseConsoleDraft('api_info', JSON.stringify([{ ...valid, route: '' }]));
  assert.equal(blank.valid, false);
  assert.equal(blank.rows[0].route, '');
  assert.equal(parseConsoleDraft('faq', '{broken').rows, null);
  assert.equal(parseConsoleDraft('faq', '[{"question":12,"answer":"x"}]').valid, false);
  assert.equal(invalidConsoleContentChanges({ 'console_setting.faq': '[{"question":"incomplete"}]', Notice: 'Other draft' }), true);
  assert.equal(invalidConsoleContentChanges({ 'console_setting.faq': '[]', Notice: 'Other draft' }), false);
  for (const url of ['javascript:alert(1)', '//other.example.com', 'https://user:secret@api.example.com', 'https:\\evil.example.com']) assert.deepEqual(parseApiInfo([{ ...valid, url }]), []);
  assert.deepEqual(parseApiInfo([valid, { ...valid, color: 'invented' }]), [valid]);
});

test('FAQ limits match UTF16 character counts while preserving Markdown answers', () => {
  const faq = { question: '问'.repeat(200), answer: '答'.repeat(1000) };
  assert.equal(parseConsoleDraft('faq', JSON.stringify([faq])).valid, true);
  assert.equal(parseConsoleDraft('faq', JSON.stringify([{ ...faq, answer: '😀'.repeat(501) }])).valid, false);
  assert.equal(parseConsoleDraft('faq', JSON.stringify(Array(101).fill(faq))).valid, false);
  const markdown = { question: 'Connect?', answer: 'Use **an API key**.' };
  assert.deepEqual(parseFAQ([markdown]), [markdown]);
});
