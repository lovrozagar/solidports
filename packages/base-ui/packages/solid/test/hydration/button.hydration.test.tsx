/*
 * Hydration: server-rendered Buttons are claimed by the client on the native path (D33 batch
 * 4a-1), keeping the server's elements with no hydration mismatch and their handlers attached;
 * props that force the slow path do so on both sides, and a button inside a composite root takes
 * the composite path on both. After hydration each button holds the attributes a client render
 * holds. The budget counts the reactive nodes `hydrate()` creates per button (the dev `onOwner`
 * hook), against the slow path's.
 */
import { DEV, flush } from 'solid-js';
import { hydrate, render } from '@solidjs/web';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderPathOf } from '../../src/utils/renderPath';
import {
  ButtonBudget,
  ButtonFixture,
  forwardedRef,
  getterRef,
  pressCount,
} from './button.fixture';
import { serverHtml } from './serverHtml';

type Hooks = { onOwner?: (owner: unknown) => void };
const hooks = (DEV as unknown as { hooks: Hooks }).hooks;

/**
 * Reactive nodes one more hydrated button creates, exact: SLOW on the slow path (measured before
 * the port, 2026-10-25), NATIVE on the native path.
 */
const SLOW_PER_BUTTON = 22;
const NATIVE_PER_BUTTON = 1;

const NATIVE = [
  'plain',
  'disabled',
  'focusable',
  'reactive-disabled',
  'submit',
  'handler',
  'class-fn',
  'ref-forward',
];
const SLOW = ['render-getter', 'spread', 'native-button', 'composite', 'getter-ref'];
const ALL = [...NATIVE, ...SLOW];

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

/** Each button's attributes, generated ids and hydration keys left out. */
function attributes(container: Element) {
  return Object.fromEntries(
    ALL.map((id) => {
      const button = container.querySelector(`[data-testid="${id}"]`)!;
      return [
        id,
        Object.fromEntries(
          [...button.attributes]
            .filter(({ name }) => name !== '_hk' && name !== 'data-hk' && name !== 'id')
            .map(({ name, value }) => [name, value])
            .sort(([a], [b]) => (a < b ? -1 : 1)),
        ),
      ];
    }),
  );
}

describe('hydrated Button', () => {
  it("claims the server's buttons on their paths, with no mismatch", async () => {
    const client = document.createElement('div');
    document.body.append(client);
    const view = render(() => <ButtonFixture />, client);
    flush();
    const expected = attributes(client);
    view();
    client.remove();

    const container = serverContainer('button.server.tsx');
    const query = (id: string) => container.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
    const server = Object.fromEntries(ALL.map((id) => [id, query(id)]));
    expect(ALL.filter((id) => !server[id])).toEqual([]);
    const warn = vi.spyOn(console, 'warn');
    const error = vi.spyOn(console, 'error');
    dispose = hydrate(() => <ButtonFixture />, container);
    flush();
    await Promise.resolve();
    flush();
    const messages = [...warn.mock.calls, ...error.mock.calls].map(String);
    expect(messages.filter((message) => /hydrat|mismatch|unclaimed/i.test(message))).toEqual([]);
    expect(ALL.filter((id) => query(id) !== server[id])).toEqual([]);
    expect(Object.fromEntries(NATIVE.map((id) => [id, renderPathOf(query(id))]))).toEqual(
      Object.fromEntries(NATIVE.map((id) => [id, 'native'])),
    );
    expect(Object.fromEntries(SLOW.map((id) => [id, renderPathOf(query(id))]))).toEqual(
      Object.fromEntries(SLOW.map((id) => [id, 'slow'])),
    );
    expect(forwardedRef()).toBe(query('ref-forward'));
    expect(getterRef()).toBe(query('getter-ref'));
    expect(attributes(container)).toEqual(expected);
    // The hydrated button's handlers are attached.
    const before = pressCount();
    query('handler').click();
    flush();
    expect(pressCount()).toBe(before + 1);
  });

  /** Reactive nodes `hydrate()` creates for the server HTML of `file` (the budget's copies). */
  function hydrationNodes(file: string, count: number) {
    const container = serverContainer(file);
    let nodes = 0;
    hooks.onOwner = (owner) => {
      nodes += owner ? 1 : 0;
    };
    const stop = hydrate(() => <ButtonBudget count={count} />, container);
    flush();
    hooks.onOwner = undefined;
    stop();
    document.body.innerHTML = '';
    return nodes;
  }

  it('hydrates a button at its native budget, below the slow path', () => {
    const perButton =
      hydrationNodes('button-budget-2.server.tsx', 2) -
      hydrationNodes('button-budget-1.server.tsx', 1);
    expect(perButton).toBe(NATIVE_PER_BUTTON);
    expect(NATIVE_PER_BUTTON).toBeLessThan(SLOW_PER_BUTTON);
  });
});
