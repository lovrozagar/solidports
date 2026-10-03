import { afterEach, describe, expect, it } from 'vitest';
import { createRenderer } from '#test-utils';
import { ScrollArea } from '@solidports/base-ui/scroll-area';

// Solid-only: Solid's client `useHead` applies no CSP nonce, so a disable-scrollbar style created in
// the browser takes the page nonce from the `csp-nonce` meta convention when no CSPProvider nonce
// is set.
describe('useStyleDisableScrollbar', () => {
  const { render } = createRenderer();

  afterEach(() => {
    document.head.querySelectorAll('meta[name="csp-nonce"]').forEach((meta) => meta.remove());
  });

  it('applies the page csp-nonce meta to a style created in the browser', () => {
    const meta = document.createElement('meta');
    meta.name = 'csp-nonce';
    meta.content = 'page-nonce';
    document.head.appendChild(meta);

    render(() => (
      <ScrollArea.Root>
        <ScrollArea.Viewport />
      </ScrollArea.Root>
    ));

    const styles = document.head.querySelectorAll<HTMLStyleElement>(
      'style[href="base-ui-disable-scrollbar"]',
    );
    expect(styles).toHaveLength(1);
    expect(styles[0].nonce || styles[0].getAttribute('nonce')).toBe('page-nonce');
  });
});
