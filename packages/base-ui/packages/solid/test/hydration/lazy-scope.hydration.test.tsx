/*
 * The lazy-scope contract (`runInLazyScope`): nothing a hydration claims may live in a scope, since
 * a scope's ids differ between the server and the client. In development, an element claimed
 * inside one while hydrating fails with an error that says so, instead of a key miss that leaves
 * the server's element inert.
 */
import { flush } from 'solid-js';
import { hydrate } from '@solidjs/web';
import { afterEach, describe, expect, inject, it } from 'vitest';
import { caught, LazyScopeElement } from './lazy-scope.fixture';

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.innerHTML = '';
});

describe('runInLazyScope while hydrating', () => {
  it('fails when an element is claimed inside the scope', () => {
    const html = inject('serverHtml')['lazy-scope.server.tsx'];
    if (!html) {
      throw new Error('globalSetup did not server-render lazy-scope.server.tsx');
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
    caught.error = undefined;
    dispose = hydrate(() => <LazyScopeElement />, container);
    flush();
    expect(String(caught.error)).toMatch(/Base UI: An element was hydrated inside a lazy scope/);
  });
});
