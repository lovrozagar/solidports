/*
 * Hydration: server-rendered tabs, hydrated on the client, must wire each tab to its panel
 * (`aria-controls` / `aria-labelledby`) as a client render does.
 */
import { flush } from 'solid-js';
import { hydrate } from '@solidjs/web';
import { afterEach, describe, expect, it } from 'vitest';
import { serverRender } from './serverRender';
import { TabsFixture } from './tabs.fixture';

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  document.body.innerHTML = '';
});

describe('hydrated Tabs', () => {
  it('wires each tab to its panel', async () => {
    const container = document.createElement('div');
    container.innerHTML = await serverRender('tabs.server.tsx');
    document.body.append(container);
    (window as unknown as { _$HY: object })._$HY = {
      completed: new WeakSet(),
      done: false,
      events: [],
      fe() {},
      r: {},
    };
    dispose = hydrate(() => <TabsFixture />, container);
    flush();
    await new Promise((done) => setTimeout(done, 0));
    flush();
    const tabs = [...container.querySelectorAll('[role="tab"]')];
    const panel = container.querySelector('[role="tabpanel"]');
    expect(tabs).toHaveLength(2);
    expect(panel).not.toBeNull();
    expect(tabs[0]).toHaveAttribute('aria-controls', panel?.id);
    expect(panel).toHaveAttribute('aria-labelledby', tabs[0]?.id);
  }, 60_000);
});
