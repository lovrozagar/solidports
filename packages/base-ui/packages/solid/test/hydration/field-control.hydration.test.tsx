/*
 * Hydration: server-rendered Field.Controls and Inputs are claimed by the client on the native
 * path (D33 server batch, S.1), keeping the server's elements and their values with no hydration
 * mismatch; props that force the slow path do so on both sides. The budget counts the reactive
 * nodes `hydrate()` creates per field (the dev `onOwner` hook), against the slow path's.
 */
import { DEV, flush } from 'solid-js';
import { hydrate } from '@solidjs/web';
import { afterEach, describe, expect, inject, it, vi } from 'vitest';
import { renderPathOf } from '../../src/utils/renderPath';
import {
  FieldControlBudget,
  FieldControlFixture,
  forwardedRef,
  getterRef,
} from './field-control.fixture';

type Hooks = { onOwner?: (owner: unknown) => void };
const hooks = (DEV as unknown as { hooks: Hooks }).hooks;

let dispose: (() => void) | undefined;
afterEach(() => {
  hooks.onOwner = undefined;
  dispose?.();
  dispose = undefined;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function serverContainer(file: string) {
  const html = inject('serverHtml')[file];
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
 * Reactive nodes one more hydrated field (Field.Root and a Field.Control) creates, exact: 65 with
 * the control on the slow path (measured before the port, 2026-10-24), 34 on the native path.
 */
const SLOW_PER_FIELD = 65;
const NATIVE_PER_FIELD = 34;

const NATIVE = ['uncontrolled', 'controlled', 'bare', 'input', 'ref-forward'];
const SLOW = ['render-getter', 'spread', 'getter-ref'];

describe('hydrated Field.Control and Input', () => {
  it("claims the server's controls on their paths, with their values and no mismatch", async () => {
    const container = serverContainer('field-control.server.tsx');
    const query = (id: string) => container.querySelector<HTMLInputElement>(`[data-testid="${id}"]`)!;
    const server = Object.fromEntries([...NATIVE, ...SLOW].map((id) => [id, query(id)]));
    expect(Object.values(server).every(Boolean)).toBe(true);
    const warn = vi.spyOn(console, 'warn');
    const error = vi.spyOn(console, 'error');
    dispose = hydrate(() => <FieldControlFixture />, container);
    flush();
    // The form state hands over once `hydrate()` has returned.
    await Promise.resolve();
    flush();
    const messages = [...warn.mock.calls, ...error.mock.calls].map(String);
    expect(messages.filter((message) => /hydrat|mismatch|unclaimed/i.test(message))).toEqual([]);
    // The server's own elements, every one.
    expect([...NATIVE, ...SLOW].filter((id) => query(id) !== server[id])).toEqual([]);
    expect(Object.fromEntries(NATIVE.map((id) => [id, renderPathOf(query(id))]))).toEqual(
      Object.fromEntries(NATIVE.map((id) => [id, 'native'])),
    );
    expect(Object.fromEntries(SLOW.map((id) => [id, renderPathOf(query(id))]))).toEqual(
      Object.fromEntries(SLOW.map((id) => [id, 'slow'])),
    );
    expect(forwardedRef()).toBe(query('ref-forward'));
    expect(getterRef()).toBe(query('getter-ref'));
    // Uncontrolled controls keep their default as the attribute, as a client render does; a
    // controlled one keeps only the property.
    const defaults = { uncontrolled: 'Ada', bare: 'Cy', input: 'Di', 'ref-forward': 'Rae', spread: 'Sam' };
    const held = (read: (el: HTMLInputElement) => string | null) =>
      Object.fromEntries(Object.keys(defaults).map((id) => [id, read(query(id))]));
    expect(held((el) => el.value)).toEqual(defaults);
    expect(held((el) => el.getAttribute('value'))).toEqual(defaults);
    expect(query('controlled').value).toBe('Bo');
    expect(query('controlled').hasAttribute('value')).toBe(false);
  });

  /** Reactive nodes `hydrate()` creates for the server HTML of `file` (the budget's copies). */
  function hydrationNodes(file: string, count: number) {
    const container = serverContainer(file);
    let nodes = 0;
    hooks.onOwner = (owner) => {
      nodes += owner ? 1 : 0;
    };
    const stop = hydrate(() => <FieldControlBudget count={count} />, container);
    flush();
    hooks.onOwner = undefined;
    stop();
    document.body.innerHTML = '';
    return nodes;
  }

  it('hydrates a field at its native budget, below the slow path', () => {
    const perField =
      hydrationNodes('field-control-budget-2.server.tsx', 2) -
      hydrationNodes('field-control-budget-1.server.tsx', 1);
    expect(perField).toBe(NATIVE_PER_FIELD);
    expect(NATIVE_PER_FIELD).toBeLessThan(SLOW_PER_FIELD);
  });
});

