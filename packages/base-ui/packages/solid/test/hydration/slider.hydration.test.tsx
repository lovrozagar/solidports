/*
 * Hydration: server-rendered sliders are claimed by the client on the native path (D33 server
 * batch, S.3), keeping the server's elements with no hydration mismatch; props that force the slow
 * path do so on both sides. An inset (edge-aligned) slider's prehydration script positions its
 * thumbs and indicator before hydration: from then until the slider settles, a thumb or indicator
 * the script showed is never hidden again, and no position it set goes back to the server's. The
 * budget counts the reactive nodes `hydrate()` creates per slider (the dev `onOwner` hook).
 */
import { DEV, flush } from 'solid-js';
import { hydrate } from '@solidjs/web';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderPathOf } from '../../src/utils/renderPath';
import {
  forwardedRef,
  getterRef,
  ScriptedSliders,
  SliderBudget,
  SliderFixture,
} from './slider.fixture';
import { serverHtml } from './serverHtml';

type Hooks = { onOwner?: (owner: unknown) => void };
const hooks = (DEV as unknown as { hooks: Hooks }).hooks;

/**
 * Reactive nodes one more hydrated slider (Root, Control, Track, Indicator, Thumb) creates, exact:
 * 168 with the ported parts on the slow path (measured before the port, 2026-10-24), 53 native.
 */
const SLOW_PER_SLIDER = 168;
const NATIVE_PER_SLIDER = 53;

const PATHS = {
  'a-root': 'native',
  'a-label': 'native',
  'a-value': 'native',
  'a-control': 'native',
  'a-track': 'native',
  'a-indicator': 'native',
  'a-thumb': 'native',
  'b-root': 'native',
  'b-control': 'native',
  'b-indicator': 'native',
  'b-thumb': 'native',
  'c-root': 'native',
  'c-indicator': 'native',
  'c-thumb-0': 'native',
  'c-thumb-1': 'native',
  'd-ref-forward': 'native',
  'd-render-getter': 'slow',
  'd-spread': 'slow',
  'd-getter-ref': 'slow',
};
/** The parts an inset slider's prehydration script styles. */
const SCRIPTED = ['b-thumb', 'b-indicator', 'c-thumb-0', 'c-thumb-1', 'c-indicator'];
const CUSTOM_PROPERTIES = ['--position', '--start-position', '--end-position', '--relative-size'];

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
 * none): each with itself as `document.currentScript`, which the slider's script starts from.
 */
function runServerScripts(container: Element) {
  for (const script of container.querySelectorAll('script')) {
    // eslint-disable-next-line no-new-func -- the server's own prehydration script, as a browser runs it
    new Function('document', script.textContent ?? '')({ currentScript: script });
  }
}

/** A style string's visibility and custom properties. */
function styleState(style: string | null) {
  const probe = document.createElement('div');
  probe.setAttribute('style', style ?? '');
  return {
    visibility: probe.style.visibility,
    ...Object.fromEntries(
      CUSTOM_PROPERTIES.map((name) => [name, probe.style.getPropertyValue(name)]),
    ),
  };
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

describe('hydrated Slider', () => {
  it("claims the server's sliders on their paths, with no mismatch", async () => {
    const container = serverContainer('slider.server.tsx');
    const query = (id: string) => container.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
    const server = Object.fromEntries(Object.keys(PATHS).map((id) => [id, query(id)]));
    expect(Object.keys(PATHS).filter((id) => !server[id])).toEqual([]);
    runServerScripts(container);
    const warn = vi.spyOn(console, 'warn');
    const error = vi.spyOn(console, 'error');
    dispose = hydrate(() => <SliderFixture />, container);
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

  /**
   * Hydrates the scripted sliders' server HTML on one path, as a browser would: a MutationObserver
   * on each scripted part from before the script runs, then the script, then `hydrate()` and the
   * slider settling. Returns each part's path, where a part the script showed was hidden again or
   * a position it set went missing or back to the server's, and each part's settled style.
   */
  async function hydrateScripted(slow: boolean, collapse = false) {
    let collapsed = false;
    // The slider's layout as a browser lays it out (jsdom has none, so its sizes would be 0 and the
    // script would show nothing): a 200px control and 10px thumbs, for the script and the hydrated
    // slider's own measurement alike.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function rect(
      this: Element,
    ) {
      let width = 0;
      if (collapsed) {
        // Collapsed: every box is empty.
      } else if (this.hasAttribute('data-base-ui-slider-control')) {
        width = 200;
      } else if (this.querySelector(':scope > input[type="range"]')) {
        width = 10;
      }
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: width,
        bottom: 10,
        width,
        height: 10,
      } as DOMRect;
    });
    const container = serverContainer(`slider-scripted-${slow ? 'slow' : 'native'}.server.tsx`);
    const parts = SCRIPTED.map((id) =>
      container.querySelector<HTMLElement>(`[data-testid="${id}"]`)!,
    );
    const serverStates = parts.map((part) => styleState(part.getAttribute('style')));
    const observer = new MutationObserver(() => {});
    for (const part of parts) {
      observer.observe(part, {
        attributes: true,
        attributeFilter: ['style'],
        attributeOldValue: true,
      });
    }
    runServerScripts(container);
    observer.takeRecords();
    const scriptStates = parts.map((part) => styleState(part.getAttribute('style')));
    // The layout collapsing between the script and hydration (a late style hiding the slider): the
    // hydrated slider measures nothing.
    collapsed = collapse;
    const warn = vi.spyOn(console, 'warn');
    const error = vi.spyOn(console, 'error');
    dispose = hydrate(() => <ScriptedSliders slow={slow} />, container);
    await settle();
    const records = observer.takeRecords();
    observer.disconnect();
    const messages = [...warn.mock.calls, ...error.mock.calls].map(String);
    const clobbers: string[] = [];
    parts.forEach((part, index) => {
      const own = records.filter((record) => record.target === part);
      // Every style the part held from the script's result through the settled slider.
      const sequence = [
        scriptStates[index],
        ...own.slice(1).map((record) => styleState(record.oldValue)),
        styleState(part.getAttribute('style')),
      ];
      const shown = scriptStates[index].visibility !== 'hidden';
      for (const [step, state] of sequence.entries()) {
        if (shown && state.visibility === 'hidden') {
          clobbers.push(`${SCRIPTED[index]} hidden again at step ${step}`);
        }
        for (const name of CUSTOM_PROPERTIES) {
          const key = name as keyof typeof state;
          const set = scriptStates[index][key];
          const server = serverStates[index][key];
          if (set && set !== server && !state[key]) {
            clobbers.push(`${SCRIPTED[index]} lost ${name} at step ${step}`);
          } else if (set && set !== server && state[key] === server) {
            clobbers.push(
              `${SCRIPTED[index]} ${name} back to the server's ${server} at step ${step}`,
            );
          }
        }
      }
    });
    const result = {
      paths: parts.map((part) => renderPathOf(part)),
      shown: scriptStates.map((state) => state.visibility),
      clobbers,
      settled: parts.map((part) => styleState(part.getAttribute('style'))),
      mismatches: messages.filter((message) => /hydrat|mismatch|unclaimed/i.test(message)),
    };
    dispose?.();
    dispose = undefined;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    return result;
  }

  it('never hides a part the prehydration script showed, or moves it back, and settles as the slow path does', async () => {
    const slow = await hydrateScripted(true);
    const native = await hydrateScripted(false);
    expect(slow.paths).toEqual(SCRIPTED.map(() => 'slow'));
    expect(native.paths).toEqual(SCRIPTED.map(() => 'native'));
    // The script showed every scripted part, so the checks have something to hold.
    expect(native.shown).toEqual(SCRIPTED.map(() => ''));
    expect(native.mismatches).toEqual([]);
    expect(native.clobbers).toEqual([]);
    // A writer that diffed against the server's markup instead of the DOM the script changed would
    // settle elsewhere than the slow path, which re-applies its attributes after hydration.
    expect(native.settled).toEqual(slow.settled);
  });

  it('settles as the slow path does when the layout collapses between the script and hydration', async () => {
    const slow = await hydrateScripted(true, true);
    const native = await hydrateScripted(false, true);
    expect(slow.paths).toEqual(SCRIPTED.map(() => 'slow'));
    expect(native.paths).toEqual(SCRIPTED.map(() => 'native'));
    // The script showed every scripted part, so the hydrated sliders have its result to undo.
    expect(native.shown).toEqual(SCRIPTED.map(() => ''));
    expect(native.mismatches).toEqual([]);
    // Visibility and every position variable, part by part.
    expect(native.settled).toEqual(slow.settled);
  });

  /** Reactive nodes `hydrate()` creates for the server HTML of `file` (the budget's copies). */
  function hydrationNodes(file: string, count: number) {
    const container = serverContainer(file);
    let nodes = 0;
    hooks.onOwner = (owner) => {
      nodes += owner ? 1 : 0;
    };
    const stop = hydrate(() => <SliderBudget count={count} />, container);
    flush();
    hooks.onOwner = undefined;
    stop();
    document.body.innerHTML = '';
    return nodes;
  }

  it('hydrates a slider at its native budget, below the slow path', () => {
    const perSlider =
      hydrationNodes('slider-budget-2.server.tsx', 2) -
      hydrationNodes('slider-budget-1.server.tsx', 1);
    expect(perSlider).toBe(NATIVE_PER_SLIDER);
    expect(NATIVE_PER_SLIDER).toBeLessThan(SLOW_PER_SLIDER);
  });
});
