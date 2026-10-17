/*
 * Native vs slow path parity for Meter.Track and Meter.Indicator: the same tree through the native
 * fast paths and through `useRenderElement` (`render="div"` on every part) must produce identical
 * DOM after mount and after every update, and apply refs the same way.
 */
import { createRenderer, expectNativePath, expectSlowPath } from '#test-utils';
import { Meter } from '@solidports/base-ui/meter';
import { createSignal } from 'solid-js';
import { describe, expect, it, vi } from 'vitest';
import type { JSX } from '@solidjs/web';
import { part, mountParity } from '../../test/parityHarness';

describe('native parity: Meter', () => {
  const { render } = createRenderer();

  const track = (root: HTMLElement) => root.querySelector<HTMLElement>('[data-testid="track"]')!;
  const indicator = (root: HTMLElement) =>
    root.querySelector<HTMLElement>('[data-testid="indicator"]')!;

  function tree(
    slow: boolean,
    value: () => number,
    trackProps: object = {},
    indicatorProps: object = {},
  ) {
    return part(Meter.Root, slow, 'div', {
      get value() {
        return value();
      },
      get children() {
        return part(
          Meter.Track,
          slow,
          'div',
          Object.defineProperties(
            {
              'data-testid': 'track',
              get children() {
                return part(
                  Meter.Indicator,
                  slow,
                  'div',
                  Object.defineProperties(
                    { 'data-testid': 'indicator' },
                    Object.getOwnPropertyDescriptors(indicatorProps),
                  ) as Meter.Indicator.Props,
                );
              },
            },
            Object.getOwnPropertyDescriptors(trackProps),
          ),
        );
      },
    });
  }

  it('renders and updates identically', () => {
    const [value, setValue] = createSignal(10);
    const pair = mountParity(render, (slow) => tree(slow, value));
    pair.same();
    expectNativePath(track(pair.fast));
    expectNativePath(indicator(pair.fast));
    expectSlowPath(track(pair.slow));
    expectSlowPath(indicator(pair.slow));
    expect(indicator(pair.fast).style.width).toBe('10%');
    pair.both(() => setValue(75));
    expect(indicator(pair.fast).style.width).toBe('75%');
    pair.both(() => setValue(0));
    pair.unmount();
  });

  it('renders and updates identically with every prop form', () => {
    const [value, setValue] = createSignal(30);
    const [title, setTitle] = createSignal('a');
    const pair = mountParity(render, (slow) =>
      tree(
        slow,
        value,
        {
          // `class`/`style` functions receive an empty state on both paths.
          class: (state: object) => `keys-${Object.keys(state).length}`,
          style: { color: 'red' },
          get title() {
            return title();
          },
        },
        {
          style: 'margin: 1px' as unknown as JSX.CSSProperties,
          'aria-hidden': 'true',
        },
      ),
    );
    pair.same();
    expect(track(pair.fast)).toHaveClass('keys-0');
    pair.both(() => setTitle('b'));
    pair.both(() => setValue(90));
    pair.unmount();
  });

  it('applies refs the same way', () => {
    const run = (slow: boolean) => {
      const trackRef = vi.fn();
      const indicatorRef = { current: null as Element | null };
      const view = render(() => tree(slow, () => 50, { ref: trackRef }, { ref: indicatorRef }));
      const tags = [
        trackRef.mock.calls.map((call) => (call[0] as Element).tagName).join(),
        indicatorRef.current?.tagName,
      ];
      view.unmount();
      return tags;
    };
    expect(run(false)).toEqual(['DIV', 'DIV']);
    expect(run(false)).toEqual(run(true));
  });
});
