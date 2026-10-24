/*
 * Hydration of native form controls (D33 server batch, S.0): the server's form-state attributes
 * (`value`) meet a client write of `defaultValue` or a property, as on the slow path. The client
 * claims each control with no mismatch, keeps its value, and leaves the attributes a client render
 * has: an uncontrolled control keeps `value` (its default), a controlled one and an OTP-style slot
 * keep none.
 */
import { flush } from 'solid-js';
import { hydrate } from '@solidjs/web';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormStateFixture } from './form-state.fixture';
import { serverHtml } from './serverHtml';

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function serverContainer() {
  const html = serverHtml('form-state.server.tsx');
  if (!html) {
    throw new Error('globalSetup did not server-render form-state.server.tsx');
  }
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.append(container);
  return { html, container };
}

const input = (container: Element, id: string) =>
  container.querySelector<HTMLInputElement>(`[data-testid="${id}"]`)!;

describe('hydrated native form controls', () => {
  it('prints each value once on the server, as the attribute', () => {
    const { html, container } = serverContainer();
    expect(html.split(' value=').length - 1).toBe(3);
    expect(html).not.toMatch(/defaultvalue/i);
    expect(input(container, 'uncontrolled').getAttribute('value')).toBe('Ada');
    expect(input(container, 'controlled').getAttribute('value')).toBe('Bo');
    expect(input(container, 'slot').getAttribute('value')).toBe('7');
  });

  it('claims the server inputs with no mismatch and leaves the attributes a client render has', async () => {
    const { container } = serverContainer();
    const server = ['uncontrolled', 'controlled', 'slot'].map((id) => input(container, id));
    (window as unknown as { _$HY: object })._$HY = {
      completed: new WeakSet(),
      done: false,
      events: [],
      fe() {},
      r: {},
    };
    const warn = vi.spyOn(console, 'warn');
    const error = vi.spyOn(console, 'error');
    dispose = hydrate(() => <FormStateFixture />, container);
    flush();
    // The release runs once `hydrate()` has returned, as the slow path's.
    await Promise.resolve();
    flush();
    const messages = [...warn.mock.calls, ...error.mock.calls].map(String);
    expect(messages.filter((message) => /hydrat|mismatch/i.test(message))).toEqual([]);
    const [uncontrolled, controlled, slot] = ['uncontrolled', 'controlled', 'slot'].map((id) =>
      input(container, id),
    );
    expect([uncontrolled, controlled, slot]).toEqual(server);
    expect(uncontrolled.value).toBe('Ada');
    expect(uncontrolled.getAttribute('value')).toBe('Ada');
    expect(controlled.value).toBe('Bo');
    expect(controlled.hasAttribute('value')).toBe(false);
    // The slot keeps the server's character as its live value, with no attribute left.
    expect(slot.value).toBe('7');
    expect(slot.hasAttribute('value')).toBe(false);
  });
});
