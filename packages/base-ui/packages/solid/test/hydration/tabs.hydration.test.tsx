/*
 * Hydration: server-rendered tabs are claimed by the client on the native path (D33 batch 4a-1),
 * keeping the server's elements with no hydration mismatch, each tab wired to its panel; props that
 * force the slow path do so on both sides. The hydrated tabs register in the order a client render
 * registers them: the same roving tabindex, and the arrow keys move focus the same way. The
 * indicator's prehydration script positions it before hydration; from then until the tabs settle,
 * the indicator it showed is never hidden again and no position it set goes missing or back to the
 * server's. The budget counts the reactive nodes `hydrate()` creates per tab and panel (the dev
 * `onOwner` hook).
 */
import { DEV, flush } from 'solid-js';
import { hydrate, render } from '@solidjs/web';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderPathOf } from '../../src/utils/renderPath';
import {
  forwardedRef,
  getterRef,
  ScriptedTabs,
  TabsBudget,
  TabsFixture,
  TabsPathsFixture,
} from './tabs.fixture';
import { serverHtml } from './serverHtml';

type Hooks = { onOwner?: (owner: unknown) => void };
const hooks = (DEV as unknown as { hooks: Hooks }).hooks;

/**
 * Reactive nodes one more hydrated tab and its panel create, exact: SLOW with Tabs on the slow
 * path (measured before the port, 2026-10-25), NATIVE on the native path.
 */
const SLOW_PER_TAB = 46;
const NATIVE_PER_TAB = 3;

const PATHS = {
  'a-root': 'native',
  'a-list': 'native',
  'a-tab-one': 'native',
  'a-tab-two': 'native',
  'a-tab-three': 'native',
  'a-indicator': 'native',
  'a-panel-one': 'native',
  'a-panel-two': 'native',
  'a-panel-three': 'native',
  'd-ref-forward': 'native',
  'd-render-getter': 'slow',
  'd-spread': 'slow',
  'd-native-button': 'slow',
  'd-getter-ref': 'slow',
  'd-panel-spread': 'slow',
};
const TABS = ['a-tab-one', 'a-tab-two', 'a-tab-three'];
const CUSTOM_PROPERTIES = [
  '--active-tab-left',
  '--active-tab-right',
  '--active-tab-top',
  '--active-tab-bottom',
  '--active-tab-width',
  '--active-tab-height',
];

let dispose: (() => void) | undefined;
afterEach(() => {
  hooks.onOwner = undefined;
  dispose?.();
  dispose = undefined;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function serverContainer(file: string) {
  const html = serverHtml(file);
  if (!html) {
    throw new Error(`globalSetup did not server-render ${file}`);
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
  return container;
}

/**
 * Runs the server's inline scripts as a browser does while parsing (markup inserted as HTML runs
 * none): each with itself as `document.currentScript`, which the indicator's script starts from.
 */
function runServerScripts(container: Element) {
  for (const script of container.querySelectorAll('script')) {
    // eslint-disable-next-line no-new-func -- the server's own prehydration script, as a browser runs it
    new Function('document', script.textContent ?? '')({ currentScript: script });
  }
}

const settle = async () => {
  for (let frame = 0; frame < 5; frame += 1) {
    flush();
    // eslint-disable-next-line no-await-in-loop -- one frame at a time
    await new Promise((resolve) => {
      requestAnimationFrame(() => setTimeout(resolve, 0));
    });
  }
  flush();
};

/** Each tab's tabindex, and the tab focused after each ArrowRight from the first. */
async function roving(container: Element) {
  const query = (id: string) => container.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
  const tabindex = TABS.map((id) => query(id).getAttribute('tabindex'));
  const focused: (string | null)[] = [];
  query(TABS[0]).focus();
  for (let step = 0; step < TABS.length; step += 1) {
    (document.activeElement as HTMLElement).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    flush();
    // eslint-disable-next-line no-await-in-loop -- one key at a time; focus moves after a microtask
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    flush();
    focused.push((document.activeElement as HTMLElement).getAttribute('data-testid'));
  }
  return { tabindex, focused };
}

describe('hydrated Tabs', () => {
  it('wires each tab to its panel', async () => {
    const container = serverContainer('tabs.server.tsx');
    dispose = hydrate(() => <TabsFixture />, container);
    flush();
    await new Promise((done) => {
      setTimeout(done, 0);
    });
    flush();
    const tabs = [...container.querySelectorAll('[role="tab"]')];
    const panel = container.querySelector('[role="tabpanel"]');
    expect(tabs).toHaveLength(2);
    expect(panel).not.toBeNull();
    expect(tabs[0]).toHaveAttribute('aria-controls', panel?.id);
    expect(panel).toHaveAttribute('aria-labelledby', tabs[0]?.id);
  });

  it("claims the server's parts on their paths, with no mismatch", async () => {
    const container = serverContainer('tabs-paths.server.tsx');
    const query = (id: string) => container.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
    const server = Object.fromEntries(Object.keys(PATHS).map((id) => [id, query(id)]));
    expect(Object.keys(PATHS).filter((id) => !server[id])).toEqual([]);
    const warn = vi.spyOn(console, 'warn');
    const error = vi.spyOn(console, 'error');
    dispose = hydrate(() => <TabsPathsFixture />, container);
    await settle();
    const messages = [...warn.mock.calls, ...error.mock.calls].map(String);
    expect(messages.filter((message) => /hydrat|mismatch|unclaimed/i.test(message))).toEqual([]);
    expect(Object.keys(PATHS).filter((id) => query(id) !== server[id])).toEqual([]);
    expect(
      Object.fromEntries(Object.keys(PATHS).map((id) => [id, renderPathOf(query(id))])),
    ).toEqual(PATHS);
    expect(forwardedRef()).toBe(query('d-ref-forward'));
    expect(getterRef()).toBe(query('d-getter-ref'));
  });

  it('registers the hydrated tabs in a client render’s order', async () => {
    const client = document.createElement('div');
    document.body.append(client);
    const view = render(() => <TabsPathsFixture />, client);
    await settle();
    const expected = await roving(client);
    view();
    client.remove();

    const container = serverContainer('tabs-paths.server.tsx');
    dispose = hydrate(() => <TabsPathsFixture />, container);
    await settle();
    // The roving tabindex on the active (first) tab, and focus moving tab to tab and wrapping.
    expect(expected).toEqual({
      tabindex: ['0', '-1', '-1'],
      focused: ['a-tab-two', 'a-tab-three', 'a-tab-one'],
    });
    expect(await roving(container)).toEqual(expected);
  });

  /** A style string's custom properties, and whether the element is hidden. */
  function indicatorState(el: Element, style: string | null, hidden: boolean) {
    const probe = document.createElement('div');
    probe.setAttribute('style', style ?? '');
    return {
      hidden,
      ...Object.fromEntries(
        CUSTOM_PROPERTIES.map((name) => [name, probe.style.getPropertyValue(name)]),
      ),
      tag: el.tagName,
    };
  }

  /**
   * Hydrates the scripted tabs' server HTML on one path, as a browser would: a MutationObserver on
   * the indicator from before the script runs, then the script, then `hydrate()` and the tabs
   * settling. Returns the parts' paths, where the indicator the script showed was hidden again or a
   * position it set went missing or back to the server's, and the indicator's settled state.
   */
  async function hydrateScripted(slow: boolean) {
    // The tabs' layout as a browser lays it out (jsdom has none, so every size would be 0 and the
    // script would show nothing): two 40×20 tabs side by side in an 80×20 list. The client measures
    // the second tab half a pixel further right than its rounded layout offset, as a browser's
    // sub-pixel layout can, so a hydrated indicator that kept the script's position settles apart
    // from one that measured its own.
    const tabOf = (el: HTMLElement) => el.closest('[role="tab"]') as HTMLElement | null;
    const isList = (el: HTMLElement) => el.getAttribute('role') === 'tablist';
    const indexOf = (tab: HTMLElement) =>
      [...(tab.parentElement?.querySelectorAll('[role="tab"]') ?? [])].indexOf(tab);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function width(
      this: HTMLElement,
    ) {
      if (isList(this)) {
        return 80;
      }
      return tabOf(this) === this ? 40 : 0;
    });
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function height(
      this: HTMLElement,
    ) {
      return isList(this) || tabOf(this) === this ? 20 : 0;
    });
    vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function left(
      this: HTMLElement,
    ) {
      return tabOf(this) === this ? indexOf(this) * 40 : 0;
    });
    vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockImplementation(function scrollWidth(
      this: Element,
    ) {
      return this.getAttribute('role') === 'tablist' ? 80 : 0;
    });
    vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockImplementation(function scrollHeight(
      this: Element,
    ) {
      return this.getAttribute('role') === 'tablist' ? 20 : 0;
    });
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function rect(
      this: Element,
    ) {
      const el = this as HTMLElement;
      let box = { left: 0, width: 0, height: 0 };
      if (isList(el)) {
        box = { left: 0, width: 80, height: 20 };
      } else if (tabOf(el) === el) {
        box = { left: indexOf(el) * 40.5, width: 40, height: 20 };
      }
      return {
        x: box.left,
        y: 0,
        top: 0,
        left: box.left,
        right: box.left + box.width,
        bottom: box.height,
        width: box.width,
        height: box.height,
      } as DOMRect;
    });
    const container = serverContainer(`tabs-scripted-${slow ? 'slow' : 'native'}.server.tsx`);
    const indicator = container.querySelector<HTMLElement>('[data-testid="s-indicator"]')!;
    const state = (style: string | null, hidden: boolean) =>
      indicatorState(indicator, style, hidden);
    const serverState = state(indicator.getAttribute('style'), indicator.hasAttribute('hidden'));
    const observer = new MutationObserver(() => {});
    observer.observe(indicator, {
      attributes: true,
      attributeFilter: ['style', 'hidden'],
      attributeOldValue: true,
    });
    runServerScripts(container);
    observer.takeRecords();
    const scriptState = state(indicator.getAttribute('style'), indicator.hasAttribute('hidden'));
    const warn = vi.spyOn(console, 'warn');
    const error = vi.spyOn(console, 'error');
    dispose = hydrate(() => <ScriptedTabs slow={slow} />, container);
    await settle();
    const records = observer.takeRecords();
    observer.disconnect();
    const messages = [...warn.mock.calls, ...error.mock.calls].map(String);
    // Every state the indicator held from the script's result through the settled tabs: replay the
    // records backwards from the settled element, each record's old value undoing its change.
    let style = indicator.getAttribute('style');
    let hidden = indicator.hasAttribute('hidden');
    const sequence = [state(style, hidden)];
    for (const record of [...records].reverse()) {
      if (record.attributeName === 'style') {
        style = record.oldValue;
      } else {
        hidden = record.oldValue !== null;
      }
      sequence.unshift(state(style, hidden));
    }
    const clobbers: string[] = [];
    for (const [step, current] of sequence.entries()) {
      if (!scriptState.hidden && current.hidden) {
        clobbers.push(`indicator hidden again at step ${step}`);
      }
      for (const name of CUSTOM_PROPERTIES) {
        const key = name as keyof typeof current;
        const set = scriptState[key];
        const server = serverState[key];
        if (set && set !== server && !current[key]) {
          clobbers.push(`indicator lost ${name} at step ${step}`);
        } else if (set && set !== server && current[key] === server) {
          clobbers.push(`indicator ${name} back to the server's ${server} at step ${step}`);
        }
      }
    }
    const result = {
      paths: ['s-tab-one', 's-tab-two', 's-indicator'].map((id) =>
        renderPathOf(container.querySelector(`[data-testid="${id}"]`)!),
      ),
      script: scriptState,
      clobbers,
      settled: state(indicator.getAttribute('style'), indicator.hasAttribute('hidden')),
      mismatches: messages.filter((message) => /hydrat|mismatch|unclaimed/i.test(message)),
    };
    dispose?.();
    dispose = undefined;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    return result;
  }

  it('never hides the indicator the prehydration script showed, or moves it back, and settles as the slow path does', async () => {
    const slow = await hydrateScripted(true);
    const native = await hydrateScripted(false);
    expect(slow.paths).toEqual(['slow', 'slow', 'slow']);
    expect(native.paths).toEqual(['native', 'native', 'native']);
    // The script showed the indicator under the second tab, so the checks have something to hold.
    expect(native.script).toMatchObject({
      hidden: false,
      '--active-tab-left': '40px',
      '--active-tab-width': '40px',
    });
    expect(native.mismatches).toEqual([]);
    expect(native.clobbers).toEqual([]);
    // The hydrated indicator measured its own position, past the script's rounded one.
    expect(slow.settled['--active-tab-left']).not.toBe(native.script['--active-tab-left']);
    expect(native.settled).toEqual(slow.settled);
  });

  /** Reactive nodes `hydrate()` creates for the server HTML of `file` (the budget's copies). */
  function hydrationNodes(file: string, count: number) {
    const container = serverContainer(file);
    let nodes = 0;
    hooks.onOwner = (owner) => {
      nodes += owner ? 1 : 0;
    };
    const stop = hydrate(() => <TabsBudget count={count} />, container);
    flush();
    hooks.onOwner = undefined;
    stop();
    document.body.innerHTML = '';
    return nodes;
  }

  it('hydrates a tab and its panel at their native budget, below the slow path', () => {
    const perTab =
      hydrationNodes('tabs-budget-2.server.tsx', 2) - hydrationNodes('tabs-budget-1.server.tsx', 1);
    expect(perTab).toBe(NATIVE_PER_TAB);
    expect(NATIVE_PER_TAB).toBeLessThan(SLOW_PER_TAB);
  });
});
