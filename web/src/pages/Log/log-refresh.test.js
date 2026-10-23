import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { QueryClient, QueryObserver, environmentManager, focusManager, onlineManager } from '@tanstack/react-query';
import { loadTestModules } from '../../../scripts/load-test-modules.mjs';

const { entry0: { feedRefreshOptions } } = await loadTestModules(['./src/pages/Log/feed-data.ts']);

test('log refresh stays manual until enabled and stops polling when disabled', async (t) => {
  const wasServer = environmentManager.isServer();
  const wasFocused = focusManager.isFocused();
  const wasOnline = onlineManager.isOnline();
  environmentManager.setIsServer(() => false);
  focusManager.setFocused(true);
  onlineManager.setOnline(true);
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });

  let requests = 0;
  const client = new QueryClient();
  const options = {
    queryKey: ['log-refresh'],
    queryFn: async () => ++requests,
    retry: false,
    gcTime: Infinity,
  };
  client.mount();
  const observer = new QueryObserver(client, { ...options, ...feedRefreshOptions(false) });
  const unsubscribe = observer.subscribe(() => {});
  t.after(() => {
    unsubscribe();
    client.unmount();
    client.clear();
    environmentManager.setIsServer(() => wasServer);
    focusManager.setFocused(wasFocused);
    onlineManager.setOnline(wasOnline);
  });

  await setImmediate();
  assert.equal(requests, 1, 'initial page load fetches the logs');
  focusManager.setFocused(false);
  focusManager.setFocused(true);
  onlineManager.setOnline(false);
  onlineManager.setOnline(true);
  await setImmediate();
  t.mock.timers.tick(15000);
  await setImmediate();
  assert.equal(requests, 1, 'focus, reconnect and elapsed time do not refresh with the switch off');

  observer.setOptions({ ...options, ...feedRefreshOptions(true) });
  t.mock.timers.tick(5000);
  await setImmediate();
  assert.equal(requests, 2, 'enabling refresh polls every five seconds');
  t.mock.timers.tick(5000);
  await setImmediate();
  assert.equal(requests, 3, 'polling continues while enabled');

  observer.setOptions({ ...options, ...feedRefreshOptions(false) });
  t.mock.timers.tick(15000);
  await setImmediate();
  assert.equal(requests, 3, 'disabling refresh cancels the polling timer');
  await observer.refetch();
  assert.equal(requests, 4, 'manual refresh still works');
});
