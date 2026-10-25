/*
 * Hydration: server-rendered NumberField.Inputs are claimed by the client on the native path (D33
 * batch 4a-1), keeping the server's elements and their formatted values with no hydration
 * mismatch; props that force the slow path do so on both sides. After hydration each input holds
 * the value and the `value` attribute a client render holds. The budget counts the reactive nodes
 * `hydrate()` creates per field (the dev `onOwner` hook), against the slow path's.
 */
import { DEV, flush } from 'solid-js';
import { hydrate, render } from '@solidjs/web';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderPathOf } from '../../src/utils/renderPath';
import {
  forwardedRef,
  getterRef,
  NumberFieldBudget,
  NumberFieldFixture,
} from './number-field.fixture';
import { serverHtml } from './serverHtml';

type Hooks = { onOwner?: (owner: unknown) => void };
const hooks = (DEV as unknown as { hooks: Hooks }).hooks;

/**
 * Reactive nodes one more hydrated number field (Root and Input) creates, exact: SLOW with the
 * input on the slow path (measured before the port, 2026-10-25), NATIVE on the native path.
 */
const SLOW_PER_FIELD = 54;
const NATIVE_PER_FIELD = 21;

const NATIVE = ['uncontrolled', 'controlled', 'formatted', 'bare', 'ref-forward'];
const SLOW = ['render-getter', 'spread', 'getter-ref'];
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

/** Each input's value and `value` attribute. */
function held(container: Element) {
  return Object.fromEntries(
    ALL.map((id) => {
      const input = container.querySelector<HTMLInputElement>(`[data-testid="${id}"]`)!;
      return [id, { value: input.value, attribute: input.getAttribute('value') }];
    }),
  );
}

describe('hydrated NumberField.Input', () => {
  it("claims the server's inputs on their paths, with their values and no mismatch", async () => {
    const client = document.createElement('div');
    document.body.append(client);
    const view = render(() => <NumberFieldFixture />, client);
    flush();
    const expected = held(client);
    view();
    client.remove();

    const container = serverContainer('number-field.server.tsx');
    const query = (id: string) =>
      container.querySelector<HTMLInputElement>(`[data-testid="${id}"]`)!;
    const server = Object.fromEntries(ALL.map((id) => [id, query(id)]));
    expect(ALL.filter((id) => !server[id])).toEqual([]);
    // The server prints each input's formatted value.
    expect(Object.fromEntries(ALL.map((id) => [id, query(id).getAttribute('value')]))).toEqual({
      uncontrolled: '3',
      controlled: '42',
      formatted: '$1,234.50',
      bare: '',
      'ref-forward': '7',
      'render-getter': '5',
      spread: '6',
      'getter-ref': '8',
    });
    const warn = vi.spyOn(console, 'warn');
    const error = vi.spyOn(console, 'error');
    dispose = hydrate(() => <NumberFieldFixture />, container);
    flush();
    // The form state hands over once `hydrate()` has returned.
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
    expect(held(container)).toEqual(expected);
  });

  /** Reactive nodes `hydrate()` creates for the server HTML of `file` (the budget's copies). */
  function hydrationNodes(file: string, count: number) {
    const container = serverContainer(file);
    let nodes = 0;
    hooks.onOwner = (owner) => {
      nodes += owner ? 1 : 0;
    };
    const stop = hydrate(() => <NumberFieldBudget count={count} />, container);
    flush();
    hooks.onOwner = undefined;
    stop();
    document.body.innerHTML = '';
    return nodes;
  }

  it('hydrates a field at its native budget, below the slow path', () => {
    const perField =
      hydrationNodes('number-field-budget-2.server.tsx', 2) -
      hydrationNodes('number-field-budget-1.server.tsx', 1);
    expect(perField).toBe(NATIVE_PER_FIELD);
    expect(NATIVE_PER_FIELD).toBeLessThan(SLOW_PER_FIELD);
  });
});
