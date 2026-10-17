/*
 * Native vs slow path parity for Progress.Track and Progress.Indicator: the same tree through the
 * native fast paths and through `useRenderElement` (`render="div"` on every part) must produce
 * identical DOM after mount and after every update, and apply refs the same way.
 */
import { createRenderer, expectNativePath, expectSlowPath } from '#test-utils';
import { Progress } from '@solidports/base-ui/progress';
import { createSignal } from 'solid-js';
import { describe, expect, it, vi } from 'vitest';
import type { JSX } from '@solidjs/web';
import { part, mountParity } from '../../test/parityHarness';

describe('native parity: Progress', () => {
  const { render } = createRenderer();

  const track = (root: HTMLElement) => root.querySelector<HTMLElement>('[data-testid="track"]')!;
  const indicator = (root: HTMLElement) =>
    root.querySelector<HTMLElement>('[data-testid="indicator"]')!;

  function tree(
    slow: boolean,
    value: () => number | null,
    trackProps: object = {},
    indicatorProps: object = {},
  ) {
    return part(Progress.Root, slow, 'div', {
      get value() {
        return value();
      },
      get children() {
        return part(
          Progress.Track,
          slow,
          'div',
          Object.defineProperties(
            {
              'data-testid': 'track',
              get children() {
                return part(
                  Progress.Indicator,
                  slow,
                  'div',
                  Object.defineProperties(
                    { 'data-testid': 'indicator' },
                    Object.getOwnPropertyDescriptors(indicatorProps),
                  ) as Progress.Indicator.Props,
                );
              },
            },
            Object.getOwnPropertyDescriptors(trackProps),
          ),
        );
      },
    });
  }

  it('renders and updates identically through every status', () => {
    const [value, setValue] = createSignal<number | null>(null);
    const pair = mountParity(render, (slow) => tree(slow, value));
    pair.same();
    expectNativePath(track(pair.fast));
    expectNativePath(indicator(pair.fast));
    expectSlowPath(track(pair.slow));
    expectSlowPath(indicator(pair.slow));
    expect(track(pair.fast)).toHaveAttribute('data-indeterminate', '');
    // Indeterminate: no fill and no style attribute on either path, as React renders upstream's
    // empty style object.
    expect(indicator(pair.fast)).not.toHaveAttribute('style');
    expect(indicator(pair.slow)).not.toHaveAttribute('style');
    pair.both(() => setValue(40));
    expect(indicator(pair.fast).style.width).toBe('40%');
    expect(track(pair.fast)).toHaveAttribute('data-progressing', '');
    pair.both(() => setValue(100));
    expect(track(pair.fast)).toHaveAttribute('data-complete', '');
    pair.both(() => setValue(null));
    expect(indicator(pair.slow).getAttribute('style') ?? '').toBe(
      indicator(pair.fast).getAttribute('style') ?? '',
    );
    pair.unmount();
  });

  it('renders and updates identically with every prop form', () => {
    const [value, setValue] = createSignal<number | null>(20);
    const [title, setTitle] = createSignal('a');
    const pair = mountParity(render, (slow) =>
      tree(
        slow,
        value,
        {
          class: (state: Progress.Track.State) => `track-${state.status}`,
          style: 'margin: 1px' as unknown as JSX.CSSProperties,
          get title() {
            return title();
          },
        },
        {
          class: 'indicator',
          // The consumer's keys win over the part's fill.
          style: (state: Progress.Indicator.State) => ({
            height: state.status === 'complete' ? '2px' : '1px',
            color: 'red',
          }),
        },
      ),
    );
    pair.same();
    pair.both(() => setValue(100));
    expect(track(pair.fast)).toHaveClass('track-complete');
    // The inline fill: a real browser's computed width is in pixels.
    expect(indicator(pair.fast).style.height).toBe('2px');
    expect(indicator(pair.fast).style.width).toBe('100%');
    pair.both(() => setTitle('b'));
    pair.both(() => setValue(null));
    pair.both(() => setValue(60));
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
