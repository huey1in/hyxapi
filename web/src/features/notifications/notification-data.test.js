import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTestModules } from '../../../scripts/load-test-modules.mjs';
const { entry0: { announcementKey, mergedNotificationReadState, parseAnnouncements, parseNotificationReadState, safeAnnouncementLink } } = await loadTestModules(['./src/features/notifications/notification-data.ts']);

test('announcement read identity includes late content edits and extra details', () => {
  const [item] = parseAnnouncements([{ content: `${'same text '.repeat(5)}old`, publishDate: '2026-10-20', extra: 'details' }]);
  const key = announcementKey(item);
  assert.notEqual(key, announcementKey({ ...item, content: item.content.replace('old', 'edited') }));
  assert.notEqual(key, announcementKey({ ...item, extra: 'updated details' }));
  const read = mergedNotificationReadState({ notice: 'prior', announcements: [key] }, 'current', [key, 'next']);
  assert.deepEqual(read, { notice: 'current', announcements: [key, 'next'] });
  assert.equal(mergedNotificationReadState(read, '', []).notice, 'current');
  assert.deepEqual(parseNotificationReadState('invalid storage'), { notice: '', announcements: [] });
  assert.deepEqual(parseNotificationReadState('{"announcements":null}'), { notice: '', announcements: [] });
  assert.deepEqual(parseAnnouncements([null, {}, { content: '' }, { content: 'valid' }]).map((item) => item.content), ['valid']);
});

test('announcement destinations allow safe web and local links', () => {
  for (const url of ['javascript:alert(1)', '//other.example/path', '/\\other.example', 'https://user:password@example.com', 'data:text/html,unsafe']) assert.equal(safeAnnouncementLink(url), '');
  assert.equal(safeAnnouncementLink('/console/log'), '/console/log');
  assert.equal(safeAnnouncementLink('https://example.com/news'), 'https://example.com/news');
});
