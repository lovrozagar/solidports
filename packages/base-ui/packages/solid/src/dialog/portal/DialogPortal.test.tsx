import { createRenderer, describeConformance } from '#test-utils';
import { Dialog } from '@solidports/base-ui/dialog';
import { screen } from '@solidjs/testing-library';
import { lazy, Loading } from 'solid-js';
import type { Component } from 'solid-js';
import { expect, vi, describe, it } from 'vitest';

describe('<Dialog.Portal />', () => {
  const { render } = createRenderer();

  describeConformance(Dialog.Portal, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node, props) {
      return render(() => <Dialog.Root open>{node(props!)}</Dialog.Root>);
    },
  }));

  it('throws a descriptive error when a portaled part is rendered without <Dialog.Portal>', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      expect(() =>
        render(() => (
          <Dialog.Root open>
            <Dialog.Viewport />
          </Dialog.Root>
        )),
      ).toThrow('Base UI: <Dialog.Portal> is missing.');
    } finally {
      errorSpy.mockRestore();
    }
  });

  describe('Suspense integration', () => {
    // Issue #3695
    // Solid: portal content mounts after the host's ref write, a write after the `Loading`
    // boundary's first pass, so the outer boundary does not hold the portal's pending content
    // (creating it in the first pass would break the `let ref` + `anchor={ref}` idiom, user
    // decision 2026-10-05): the portal shows nothing until the content resolves. The regression
    // (#3695) is the update loop; the content must still appear.
    it('should not throw "Maximum update depth exceeded" when Suspense boundary is outside Portal', async () => {
      function createLazyComponent() {
        let resolvePromise: ((value: { default: Component }) => void) | null = null;
        const promise = new Promise<{ default: Component }>((resolve) => {
          resolvePromise = resolve;
        });

        return {
          LazyComponent: lazy(() => promise),
          resolve(value: { default: Component }) {
            if (!resolvePromise) {
              throw new Error('Lazy message resolver not initialized.');
            }
            resolvePromise(value);
          },
        };
      }

      const { LazyComponent, resolve } = createLazyComponent();
      // Solid's dev runtime reports the pending read the outer boundary does not hold.
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      render(() => (
        <Loading fallback="Loading…">
          <Dialog.Root open>
            <Dialog.Portal>
              <Dialog.Popup>
                <LazyComponent />
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </Loading>
      ));

      expect(screen.queryByText('Greetings')).toBe(null);
      resolve({ default: () => <p>Greetings</p> });
      expect(await screen.findByText('Greetings')).not.toBe(null);
      const warnings = warnSpy.mock.calls.map((args) => String(args[0]));
      expect(warnings.length).toBeGreaterThan(0);
      warnings.forEach((warning) => {
        expect(warning).toMatch(/^\[ASYNC_OUTSIDE_LOADING_BOUNDARY\]/);
      });
      warnSpy.mockRestore();
    });

    // Solid 2 runtime: `Portal` resolves pending content to nothing (`loadingValue`) instead of
    // suspending an outer `<Loading>`, so the boundary sits inside the portal here.
    it('should not loop when a Loading boundary wraps lazy popup content in the Portal', async () => {
      function createLazyComponent() {
        let resolvePromise: ((value: { default: Component }) => void) | null = null;
        const promise = new Promise<{ default: Component }>((resolve) => {
          resolvePromise = resolve;
        });

        return {
          LazyComponent: lazy(() => promise),
          resolve(value: { default: Component }) {
            if (!resolvePromise) {
              throw new Error('Lazy message resolver not initialized.');
            }
            resolvePromise(value);
          },
        };
      }

      const { LazyComponent, resolve } = createLazyComponent();

      render(() => (
        <Dialog.Root open>
          <Dialog.Portal>
            <Loading fallback="Loading...">
              <Dialog.Popup>
                <LazyComponent />
              </Dialog.Popup>
            </Loading>
          </Dialog.Portal>
        </Dialog.Root>
      ));

      expect(await screen.findByText('Loading...')).not.toBe(null);
      resolve({ default: () => <p>Greetings</p> });
      expect(await screen.findByText('Greetings')).not.toBe(null);
    });
  });
});
