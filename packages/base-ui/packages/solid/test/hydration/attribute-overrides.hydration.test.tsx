/*
 * Hydration: a native part's `attributeOverrides` win over the consumer's attributes on the server
 * too, so the client claims the server's element with the same attributes and no mismatch.
 */
import { flush } from 'solid-js';
import { hydrate } from '@solidjs/web';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AttributeOverridesFixture } from './attribute-overrides.fixture';
import { serverHtml } from './serverHtml';

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

const EXPECTED = {
  'aria-label': 'override',
  title: 'override title',
  'data-extra': 'x',
  class: 'consumer part',
};

describe('hydrated attribute overrides', () => {
  it("claims the server's element with the overridden attributes and no mismatch", () => {
    const html = serverHtml('attribute-overrides.server.tsx');
    if (!html) {
      throw new Error('globalSetup did not server-render attribute-overrides.server.tsx');
    }
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.append(container);
    // Each key once: the part's own write of an overridden key is skipped, not printed beside it.
    expect(Object.keys(EXPECTED).map((key) => html.split(` ${key}=`).length - 1)).toEqual(
      Object.keys(EXPECTED).map(() => 1),
    );
    const server = container.querySelector('[data-testid="override-part"]')!;
    for (const [key, value] of Object.entries(EXPECTED)) {
      expect(server.getAttribute(key)).toBe(value);
    }
    (window as unknown as { _$HY: object })._$HY = {
      completed: new WeakSet(),
      done: false,
      events: [],
      fe() {},
      r: {},
    };
    const warn = vi.spyOn(console, 'warn');
    const error = vi.spyOn(console, 'error');
    dispose = hydrate(() => <AttributeOverridesFixture />, container);
    flush();
    const messages = [...warn.mock.calls, ...error.mock.calls].map(String);
    expect(messages.filter((message) => /hydrat|mismatch/i.test(message))).toEqual([]);
    const part = container.querySelector('[data-testid="override-part"]')!;
    expect(part).toBe(server);
    for (const [key, value] of Object.entries(EXPECTED)) {
      expect(part.getAttribute(key)).toBe(value);
    }
  });
});
