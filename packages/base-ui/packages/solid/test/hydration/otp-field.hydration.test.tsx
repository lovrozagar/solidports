/*
 * Hydration: server-rendered OTP fields are claimed by the client on the native path (D33 server
 * batch, S.2): each slot keeps the server's character as its value with no `value` attribute
 * left, as a client render has it, the field's form input keeps its value, and nothing reports
 * a mismatch. Props that force the slow path do so on both sides. The budget counts the reactive
 * nodes `hydrate()` creates per field (the dev `onOwner` hook), against the slow path's.
 */
import { DEV, flush } from 'solid-js';
import { hydrate } from '@solidjs/web';
import { afterEach, describe, expect, inject, it, vi } from 'vitest';
import { renderPathOf } from '../../src/utils/renderPath';
import { forwardedRef, getterRef, OTPFieldBudget, OTPFieldFixture } from './otp-field.fixture';

type Hooks = { onOwner?: (owner: unknown) => void };
const hooks = (DEV as unknown as { hooks: Hooks }).hooks;

/**
 * Reactive nodes one more hydrated OTP field (a root and two slots) creates, exact: 149 on the
 * slow path (measured before the port, 2026-10-24), 43 on the native path.
 */
const SLOW_PER_FIELD = 149;
const NATIVE_PER_FIELD = 43;

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

const PATHS = {
  'a-root': 'native',
  'a-0': 'native',
  'a-1': 'native',
  'b-root': 'slow',
  'b-0': 'native',
  'b-1': 'native',
  'c-root': 'native',
  'c-ref-forward': 'native',
  'c-render-getter': 'slow',
  'c-spread': 'slow',
  'c-getter-ref': 'slow',
};
const SLOTS = {
  'a-0': '4',
  'a-1': '2',
  'b-0': '4',
  'b-1': '2',
  'c-ref-forward': '1',
  'c-render-getter': '2',
  'c-spread': '3',
  'c-getter-ref': '4',
};

describe('hydrated OTPField', () => {
  it("claims the server's roots and slots on their paths, with their values and no mismatch", async () => {
    const container = serverContainer('otp-field.server.tsx');
    const query = (id: string) => container.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
    const hidden = (name: string) =>
      container.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
    const server = Object.fromEntries(Object.keys(PATHS).map((id) => [id, query(id)]));
    expect(Object.values(server).every(Boolean)).toBe(true);
    const slotAttributes = Object.fromEntries(
      Object.keys(SLOTS).map((id) => [id, query(id).getAttribute('value')]),
    );
    // The server prints every slot's character.
    expect(slotAttributes).toEqual(SLOTS);
    const warn = vi.spyOn(console, 'warn');
    const error = vi.spyOn(console, 'error');
    dispose = hydrate(() => <OTPFieldFixture />, container);
    flush();
    await Promise.resolve();
    flush();
    const messages = [...warn.mock.calls, ...error.mock.calls].map(String);
    expect(messages.filter((message) => /hydrat|mismatch|unclaimed/i.test(message))).toEqual([]);
    expect(Object.keys(PATHS).filter((id) => query(id) !== server[id])).toEqual([]);
    expect(Object.fromEntries(Object.keys(PATHS).map((id) => [id, renderPathOf(query(id))]))).toEqual(
      PATHS,
    );
    expect(forwardedRef()).toBe(query('c-ref-forward'));
    expect(getterRef()).toBe(query('c-getter-ref'));
    const slots = (read: (el: HTMLInputElement) => string | null) =>
      Object.fromEntries(Object.keys(SLOTS).map((id) => [id, read(query(id) as HTMLInputElement)]));
    expect(slots((el) => el.value)).toEqual(SLOTS);
    expect(slots((el) => el.getAttribute('value'))).toEqual(
      Object.fromEntries(Object.keys(SLOTS).map((id) => [id, null])),
    );
    // The field's form value (a visually hidden text input) keeps the value as its property and,
    // as a client render, no attribute, whichever path its root took.
    expect(['a', 'b', 'c'].map((name) => hidden(name).value)).toEqual(['42', '42', '1234']);
    expect(['a', 'b', 'c'].map((name) => hidden(name).hasAttribute('value'))).toEqual([
      false,
      false,
      false,
    ]);
  });

  /** Reactive nodes `hydrate()` creates for the server HTML of `file` (the budget's copies). */
  function hydrationNodes(file: string, count: number) {
    const container = serverContainer(file);
    let nodes = 0;
    hooks.onOwner = (owner) => {
      nodes += owner ? 1 : 0;
    };
    const stop = hydrate(() => <OTPFieldBudget count={count} />, container);
    flush();
    hooks.onOwner = undefined;
    stop();
    document.body.innerHTML = '';
    return nodes;
  }

  it('hydrates an OTP field at its native budget, below the slow path', () => {
    const perField =
      hydrationNodes('otp-field-budget-2.server.tsx', 2) -
      hydrationNodes('otp-field-budget-1.server.tsx', 1);
    expect(perField).toBe(NATIVE_PER_FIELD);
    expect(NATIVE_PER_FIELD).toBeLessThan(SLOW_PER_FIELD);
  });
});
