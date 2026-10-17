/*
 * Native vs slow path parity for Separator: the same tree through the native fast path and
 * through `useRenderElement` (`render="div"`) must produce identical DOM after mount and after
 * every update, call handlers the same way and apply refs the same way.
 */
import { createRenderer, expectNativePath, expectSlowPath } from '#test-utils';
import { Separator } from '@solidports/base-ui/separator';
import { fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { describe, expect, it, vi } from 'vitest';
import type { JSX } from '@solidjs/web';
import { part, mountParity } from '../../test/parityHarness';

describe('native parity: Separator', () => {
  const { render } = createRenderer();

  const separator = (root: HTMLElement) => root.querySelector('[role], div')!;

  it('renders identically with the default and a literal orientation', () => {
    const pair = mountParity(
      render,
      (slow) =>
        [
          part(Separator, slow, 'div', {}),
          part(Separator, slow, 'div', { orientation: 'vertical' }),
        ] as unknown as JSX.Element,
    );
    pair.same();
    expectNativePath(separator(pair.fast));
    expectSlowPath(separator(pair.slow));
    expect(pair.fast.querySelector('[aria-orientation="vertical"]')).toHaveAttribute(
      'data-orientation',
      'vertical',
    );
    pair.unmount();
  });

  it('renders and updates identically with every prop form', () => {
    const [orientation, setOrientation] = createSignal<'horizontal' | 'vertical'>('horizontal');
    const [title, setTitle] = createSignal('a');
    const pair = mountParity(render, (slow) =>
      part(Separator, slow, 'div', {
        get orientation() {
          return orientation();
        },
        class: (state: Separator.State) => `is-${state.orientation}`,
        style: (state: Separator.State) => ({
          opacity: state.orientation === 'vertical' ? '0.5' : '1',
        }),
        'data-foo': 'bar',
        get title() {
          return title();
        },
        children: 'text',
      }),
    );
    pair.same();
    expectNativePath(separator(pair.fast));
    pair.both(() => setOrientation('vertical'));
    expect(separator(pair.fast)).toHaveAttribute('aria-orientation', 'vertical');
    expect(separator(pair.fast)).toHaveClass('is-vertical');
    pair.both(() => setTitle('b'));
    pair.both(() => setOrientation('horizontal'));
    pair.unmount();
  });

  it('lets the consumer override the part attributes identically', () => {
    const pair = mountParity(render, (slow) =>
      part(Separator, slow, 'div', {
        role: 'presentation',
        'aria-orientation': 'vertical',
        orientation: 'horizontal',
        style: 'margin: 1px' as unknown as JSX.CSSProperties,
      }),
    );
    pair.same();
    expect(pair.fast.firstElementChild).toHaveAttribute('role', 'presentation');
    expect(pair.fast.firstElementChild).toHaveAttribute('aria-orientation', 'vertical');
    pair.unmount();
  });

  it('calls handlers and applies refs the same way', () => {
    const run = (slow: boolean) => {
      const calls: string[] = [];
      const ref = vi.fn();
      const view = render(() =>
        part(Separator, slow, 'div', {
          ref,
          onClick: (event: MouseEvent) => calls.push(`click:${event.type}`),
        }),
      );
      fireEvent.click(view.container.firstElementChild!);
      calls.push(ref.mock.calls.map((call) => (call[0] as Element).tagName).join());
      view.unmount();
      return calls;
    };
    expect(run(false)).toEqual(['click:click', 'DIV']);
    expect(run(false)).toEqual(run(true));
  });
});
