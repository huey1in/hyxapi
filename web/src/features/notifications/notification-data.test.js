import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTestModules } from '../../../scripts/load-test-modules.mjs';
const { entry0: { announcementKey, mergedNotificationReadState, parseAnnouncements, parseNotificationReadState, safeAnnouncementLink } } = await loadTestModules(['./src/features/notifications/notification-data.ts']);

test('announcement reads preserve existing keys and discard obsolete site notice state', () => {
  assert.deepEqual(parseNotificationReadState('{"notice":"read notice","announcements":["old-key"]}'), { announcements: ['old-key'] });
  assert.deepEqual(parseNotificationReadState('{"notice":null,"announcements":["old-key"]}'), { announcements: ['old-key'] });
  assert.deepEqual(parseNotificationReadState('{"notice":"read notice","announcements":null}'), { announcements: [] });
  assert.deepEqual(parseNotificationReadState('invalid storage'), { announcements: [] });
  assert.deepEqual(parseNotificationReadState('{"notice":"previous notice"}'), { announcements: [] });
  assert.deepEqual(mergedNotificationReadState({ announcements: ['old-key'] }, ['old-key', 'new-key']), { announcements: ['old-key', 'new-key'] });
});

test('announcement identity includes late edits and optional details', () => {
  const [item] = parseAnnouncements([{ content: `${'same text '.repeat(5)}old`, publishDate: '2026-10-20', extra: 'details' }]);
  const key = announcementKey(item);
  assert.notEqual(key, announcementKey({ ...item, content: item.content.replace('old', 'edited') }));
  assert.notEqual(key, announcementKey({ ...item, extra: 'updated details' }));
});

test('announcement parsing skips invalid entries and retains content and optional details', () => {
  assert.deepEqual(parseAnnouncements([null, {}, { content: '' }, { content: 'valid' }]).map((item) => item.content), ['valid']);
  assert.deepEqual(parseAnnouncements(null), []);
  const [item] = parseAnnouncements([{ content: 'Maintenance **notice**', title: 'Update', extra: 'More details', link: '/console/log' }]);
  assert.equal(item.content, 'Maintenance **notice**');
  assert.equal(item.extra, 'More details');
  assert.equal(item.title, 'Update');
  assert.equal(item.link, '/console/log');
});

test('announcement destinations allow safe web and local links', () => {
  for (const url of ['javascript:alert(1)', '//other.example/path', '/\\other.example', '/\n/other.example', '/\t/other.example', 'https://user:password@example.com', 'data:text/html,unsafe']) assert.equal(safeAnnouncementLink(url), '');
  assert.equal(safeAnnouncementLink('/console/log'), '/console/log');
  assert.equal(safeAnnouncementLink('https://example.com/news'), 'https://example.com/news');
});
