/*
 * Hydration: server-rendered Field.Items must be claimed by the client on the native path,
 * keeping the server's elements, with no hydration mismatch (D32's sweep).
 */
import { flush } from 'solid-js';
import { hydrate } from '@solidjs/web';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderPathOf } from '../../src/utils/renderPath';
import { FieldItemFixture } from './field-item.fixture';
import { serverHtml } from './serverHtml';

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('hydrated Field.Item', () => {
  it("claims the server's items, natively and without a mismatch", () => {
    const html = serverHtml('field-item.server.tsx');
    if (!html) {
      throw new Error('globalSetup did not server-render field-item.server.tsx');
    }
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.append(container);
    const ids = ['item-fuji', 'item-gala'];
    const serverItems = ids.map((id) => container.querySelector(`[data-testid="${id}"]`));
    expect(serverItems.every(Boolean)).toBe(true);
    expect(serverItems[1]).toHaveAttribute('data-disabled');
    (window as unknown as { _$HY: object })._$HY = {
      completed: new WeakSet(),
      done: false,
      events: [],
      fe() {},
      r: {},
    };
    const warn = vi.spyOn(console, 'warn');
    const error = vi.spyOn(console, 'error');
    dispose = hydrate(() => <FieldItemFixture />, container);
    flush();
    const messages = [...warn.mock.calls, ...error.mock.calls].map(String);
    expect(messages.filter((message) => /hydrat/i.test(message))).toEqual([]);
    ids.forEach((id, index) => {
      const item = container.querySelector(`[data-testid="${id}"]`);
      expect(item).toBe(serverItems[index]);
      expect(renderPathOf(item!)).toBe('native');
    });
    expect(container.querySelector('[data-testid="item-gala"]')).toHaveAttribute('data-disabled');
  });
});
