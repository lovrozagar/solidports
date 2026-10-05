/*
 * Hydration: a server-rendered NavigationMenu trigger must claim its element children. The
 * trigger's props merge through `getButtonProps`; reading the merged `children` twice created
 * them twice, so the server printed the second copy's hydration key and the client missed it.
 */
import { flush } from 'solid-js';
import { hydrate } from '@solidjs/web';
import { afterEach, describe, expect, inject, it, vi } from 'vitest';
import { NavigationMenuFixture } from './navigation-menu.fixture';

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('hydrated NavigationMenu', () => {
  it("claims the trigger's element children", () => {
    const html = inject('serverHtml')['navigation-menu.server.tsx'];
    if (!html) throw new Error('globalSetup did not server-render navigation-menu.server.tsx');
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.append(container);
    const serverChevron = container.querySelector('[data-testid="chevron"]');
    (window as unknown as { _$HY: object })._$HY = {
      completed: new WeakSet(),
      done: false,
      events: [],
      fe() {},
      r: {},
    };
    const warn = vi.spyOn(console, 'warn');
    dispose = hydrate(() => <NavigationMenuFixture />, container);
    flush();
    const misses = warn.mock.calls.map(String).filter((message) => /hydration/i.test(message));
    expect(misses).toEqual([]);
    const trigger = container.querySelector('button');
    expect(trigger?.querySelectorAll('[data-testid="chevron"]')).toHaveLength(1);
    expect(trigger?.querySelector('[data-testid="chevron"]')).toBe(serverChevron);
  });
});
