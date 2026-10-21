/*
 * Hydration on every platform: the server cannot see the visitor's platform, so a focus guard must
 * create the same hydration-id-consuming nodes whatever the client runs on. VoiceOver on WebKit
 * (Mac and iOS Safari) gives the guards their `button` role after mount; a computation created for
 * it under the guard's owner took that owner's next hydration id on the client only, so every
 * later server node missed its key and stayed inert.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@solidjs/testing-library';
import { flush } from 'solid-js';
import { isJSDOM } from '#test-utils';
import { renderServer } from '../../test/ssrFixtures';
import menuFixtures from '../menu/root/MenuRoot.ssr-fixtures';
import popoverFixtures from '../popover/root/PopoverRoot.ssr-fixtures';

const client = vi.hoisted(() => ({ voiceOver: false, webkit: false }));


// Each flag the guards read, switched per test: the module values are computed once, at load.
vi.mock('./platform/screen-reader', () => ({
  get voiceOver() {
    return client.voiceOver;
  },
}));

vi.mock('./platform/engine', () => ({
  get webkit() {
    return client.webkit;
  },
  get gecko() {
    return false;
  },
  get blink() {
    return !client.webkit;
  },
}));

const afterHydration = () =>
  new Promise<void>((done) => {
    queueMicrotask(done);
  });

const platforms = [
  { name: 'Mac or iOS Safari', voiceOver: true, webkit: true },
  { name: 'Chrome or Firefox on a Mac', voiceOver: true, webkit: false },
  { name: 'GNOME Web', voiceOver: false, webkit: true },
  { name: 'Windows, Linux or Android', voiceOver: false, webkit: false },
];

const cases = [
  { fixtures: menuFixtures, name: 'renderTrigger' as const },
  { fixtures: menuFixtures, name: 'wrappedFilterProvider' as const },
  { fixtures: menuFixtures, name: 'submenuTrigger' as const },
  { fixtures: popoverFixtures, name: 'renderTrigger' as const },
];

afterEach(() => {
  client.voiceOver = false;
  client.webkit = false;
});

// jsdom only: the browser mocker cannot replace the platform modules the guards read, and a real
// browser is its own platform (the Mac WebKit and Safari probes cover it).
describe.skipIf(!isJSDOM).each(platforms)('focus guards hydrated on $name', (platform) => {
  it.each(cases)('claims every server node of $fixtures.file#$name', async ({ fixtures, name }) => {
    client.voiceOver = platform.voiceOver;
    client.webkit = platform.webkit;
    const { hydrate, unclaimedNodes } = renderServer(fixtures as never, name);
    const trigger = () =>
      screen.getAllByRole('button').find((button) => button.hasAttribute('aria-haspopup'));
    const serverTrigger = trigger();
    hydrate();
    await afterHydration();
    flush();
    expect(unclaimedNodes().map((node) => node.outerHTML)).toEqual([]);
    expect(serverTrigger).not.toBe(undefined);
    expect(trigger() === serverTrigger).toBe(true);
  });
});

describe.skipIf(!isJSDOM).each(platforms)('an open menu hydrated on $name', (platform) => {
  it('gives its focus guards the button role after mount on VoiceOver and WebKit only', async () => {
    client.voiceOver = platform.voiceOver;
    client.webkit = platform.webkit;
    const { hydrate } = renderServer(menuFixtures, 'submenuTrigger');
    const guards = () => [...document.querySelectorAll('[data-base-ui-focus-guard]')];
    expect(guards().map((guard) => guard.getAttribute('role'))).not.toContain('button');
    hydrate();
    await afterHydration();
    flush();
    const expected = platform.voiceOver && platform.webkit ? 'button' : null;
    expect(guards().length).toBeGreaterThan(0);
    expect(guards().map((guard) => guard.getAttribute('role'))).toEqual(
      guards().map(() => expected),
    );
  });
});
