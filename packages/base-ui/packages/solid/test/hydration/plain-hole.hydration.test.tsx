/*
 * Hydration: every server-native part inside a plain element's JSX hole (`plain-hole.fixture.tsx`)
 * keeps every keyed server element, with no hydration warning. A part whose render returns a
 * function there is called unscoped and takes the parent's hydration ids: the docs' Tabs.Panel
 * left its server elements unclaimed this way (CI run 40162124626).
 */
import { flush } from 'solid-js';
import { hydrate } from '@solidjs/web';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlainHoleFixture } from './plain-hole.fixture';
import { serverHtml } from './serverHtml';

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('server-native parts inside a plain element', () => {
  it('claim every keyed server element, with no mismatch', async () => {
    const html = serverHtml('plain-hole.server.tsx');
    if (!html) {
      throw new Error('globalSetup did not server-render plain-hole.server.tsx');
    }
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.append(container);
    (window as unknown as { _$HY: object })._$HY = {
      completed: new WeakSet(),
      done: false,
      events: [],
      fe() {},
      r: {},
    };
    const keyed = [...container.querySelectorAll('[_hk]')];
    const warn = vi.spyOn(console, 'warn');
    const error = vi.spyOn(console, 'error');
    dispose = hydrate(() => <PlainHoleFixture />, container);
    // Settle over several frames: an unscoped branch builds, and warns, after `hydrate()` returns.
    for (let frame = 0; frame < 5; frame += 1) {
      flush();
      // eslint-disable-next-line no-await-in-loop -- one frame at a time
      await new Promise((resolve) => {
        requestAnimationFrame(() => setTimeout(resolve, 0));
      });
    }
    flush();
    const messages = [...warn.mock.calls, ...error.mock.calls].map(String);
    expect(messages.filter((message) => /hydrat|mismatch|unclaimed/i.test(message))).toEqual([]);
    // A prehydration script removes itself once it has run; every other element stays.
    const lost = keyed.filter((el) => !el.isConnected && el.tagName !== 'SCRIPT');
    expect(lost.map((el) => el.outerHTML.slice(0, 100))).toEqual([]);
  });
});
