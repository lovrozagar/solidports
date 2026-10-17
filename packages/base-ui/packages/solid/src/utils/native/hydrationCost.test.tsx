/*
 * What hydrating a native part costs after `hydrate()` returns. An element whose attribute effect
 * did not re-run while hydrating holds the server's markup, which its first write matched: it
 * schedules no reconcile and writes nothing. Elements that did change reconcile in one shared
 * microtask, however many there are.
 */
import { flush } from 'solid-js';
import * as web from '@solidjs/web';
import { screen } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isJSDOM } from '#test-utils';
import { renderServer } from '../../../test/ssrFixtures';
import fixtures from './hydrationCost.ssr-fixtures';

vi.mock('@solidjs/web', async (importOriginal) => {
  const actual = await importOriginal<typeof web>();
  return { ...actual, assign: vi.fn(actual.assign) };
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Hydrates `name`; counts microtasks queued by `hydrate()` and `assign` calls after it returned. */
async function hydrateCounting(name: keyof typeof fixtures.fixtures) {
  const { hydrate } = renderServer(fixtures, name);
  const queue = globalThis.queueMicrotask;
  let microtasks = 0;
  globalThis.queueMicrotask = (callback) => {
    microtasks += 1;
    queue(callback);
  };
  try {
    hydrate();
  } finally {
    globalThis.queueMicrotask = queue;
  }
  const assign = vi.mocked(web.assign);
  assign.mockClear();
  await Promise.resolve();
  await Promise.resolve();
  flush();
  return { microtasks, writes: assign.mock.calls.length };
}

// The counts spy on `@solidjs/web`'s `assign` through a module mock, which browser mode does not
// apply to a prebundled dependency; the logic they count is the same in both.
describe.skipIf(!isJSDOM)('hydrating native parts: work after hydrate()', () => {
  it('reconciles no unchanged element and writes nothing after hydration', async () => {
    const one = await hydrateCounting('closed1');
    document.body.innerHTML = '';
    const ten = await hydrateCounting('closed10');
    expect(ten.writes).toBe(0);
    expect(one.writes).toBe(0);
    // No microtask per element: ten roots and triggers queue what one does.
    expect(ten.microtasks).toBe(one.microtasks);
  });

  it('leaves a change applied inside hydrate() to the effect, with no reconcile', async () => {
    const one = await hydrateCounting('opened1');
    document.body.innerHTML = '';
    const ten = await hydrateCounting('opened10');
    expect(screen.getAllByTestId('root').every((root) => root.hasAttribute('data-open'))).toBe(true);
    expect([one.writes, ten.writes]).toEqual([0, 0]);
    expect(ten.microtasks).toBe(one.microtasks);
  });

  it('reconciles the panels that measure while hydrating in one shared microtask', async () => {
    const closed = await hydrateCounting('closed1');
    document.body.innerHTML = '';
    const one = await hydrateCounting('panels1');
    document.body.innerHTML = '';
    const ten = await hydrateCounting('panels10');
    expect(one.microtasks).toBe(closed.microtasks + 1);
    expect(ten.microtasks).toBe(one.microtasks);
    // One reconcile write per panel.
    expect([one.writes, ten.writes]).toEqual([1, 10]);
  });

});

describe('hydrating native parts', () => {
  it('keeps the server attributes a value computed differently on the client, as compiled JSX does', async () => {
    // Solid writes nothing to a claimed element while hydrating, compiled JSX included, and React
    // does not patch attribute mismatches on hydration either: a native part matches both.
    const { hydrate } = renderServer(fixtures, 'environment');
    hydrate();
    await Promise.resolve();
    flush();
    const plain = screen.getByTestId('plain').getAttribute('data-environment');
    expect(plain).toBe('server');
    expect(screen.getByTestId('root')).toHaveAttribute('data-environment', plain);
    expect(screen.getByTestId('trigger')).toHaveAttribute('data-environment', plain);
  });
});
