import { expect, vi } from 'vitest';
import { createRenderer, describeConformance, flushMicrotasks, isJSDOM } from '#test-utils';
import { Checkbox } from '@solidports/base-ui/checkbox';
import { screen, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { CheckboxRootContext } from '../root/CheckboxRootContext';

const testContext = {
  checked: true,
  dirty: false,
  disabled: false,
  filled: false,
  focused: false,
  indeterminate: false,
  readOnly: false,
  required: false,
  touched: false,
  valid: null,
};

describe('<Checkbox.Indicator />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  const { render } = createRenderer();

  describeConformance(Checkbox.Indicator, () => ({
    refInstanceof: window.HTMLSpanElement,
    render: (node, props) =>
      render(() => <CheckboxRootContext value={testContext}>{node(props!)}</CheckboxRootContext>),
  }));

  it('throws a descriptive error when rendered outside <Checkbox.Root>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the halted render also reports a `REACTIVITY_HALTED` warning in a microtask, and
    // hands the error to `reportError` (the uncaught-error channel) where the platform has one.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const reportErrorSpy =
      typeof globalThis.reportError === 'function'
        ? vi.spyOn(globalThis, 'reportError').mockImplementation(() => {})
        : undefined;

    try {
      expect(() => render(() => <Checkbox.Indicator />)).to.throw(
        'Base UI: CheckboxRootContext is missing. Checkbox parts must be placed within <Checkbox.Root>.',
      );
    } finally {
      await flushMicrotasks();
      errorSpy.mockRestore();
      warnSpy.mockRestore();
      reportErrorSpy?.mockRestore();
    }
  });

  it('should not render indicator by default', async () => {
    render(() => (
      <Checkbox.Root>
        <Checkbox.Indicator data-testid="indicator" />
      </Checkbox.Root>
    ));
    const indicator = screen.queryByTestId('indicator');
    expect(indicator).to.equal(null);
  });

  it('should render indicator when checked', async () => {
    render(() => (
      <Checkbox.Root checked>
        <Checkbox.Indicator data-testid="indicator" />
      </Checkbox.Root>
    ));
    const indicator = screen.getByTestId('indicator');
    expect(indicator).not.to.equal(null);
  });

  it('should spread extra props', async () => {
    render(() => (
      <Checkbox.Root defaultChecked>
        <Checkbox.Indicator data-testid="indicator" data-extra-prop="Lorem ipsum" />
      </Checkbox.Root>
    ));
    const indicator = screen.getByTestId('indicator');
    expect(indicator).to.have.attribute('data-extra-prop', 'Lorem ipsum');
  });

  describe('keepMounted prop', () => {
    it('should keep indicator mounted when unchecked', async () => {
      render(() => (
        <Checkbox.Root>
          <Checkbox.Indicator data-testid="indicator" keepMounted />
        </Checkbox.Root>
      ));
      const indicator = screen.getByTestId('indicator');
      expect(indicator).not.to.equal(null);
    });

    it('should keep indicator mounted when checked', async () => {
      render(() => (
        <Checkbox.Root checked>
          <Checkbox.Indicator data-testid="indicator" keepMounted />
        </Checkbox.Root>
      ));
      const indicator = screen.getByTestId('indicator');
      expect(indicator).not.to.equal(null);
    });

    it('should keep indicator mounted when indeterminate', async () => {
      render(() => (
        <Checkbox.Root indeterminate>
          <Checkbox.Indicator data-testid="indicator" keepMounted />
        </Checkbox.Root>
      ));
      const indicator = screen.getByTestId('indicator');
      expect(indicator).not.to.equal(null);
    });
  });

  it('should remove the indicator when there is no exit animation defined', async ({ skip }) => {
    if (isJSDOM) {
      skip();
    }

    function Test() {
      const [checked, setChecked] = createSignal(true);
      return (
        <div>
          <button onClick={() => setChecked(false)}>Close</button>
          <Checkbox.Root checked={checked()}>
            <Checkbox.Indicator data-testid="indicator" />
          </Checkbox.Root>
        </div>
      );
    }

    const { user } = render(() => <Test />);

    expect(screen.getByTestId('indicator')).not.to.equal(null);

    const closeButton = screen.getByText('Close');

    await user.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByTestId('indicator')).to.equal(null);
    });
  });

  it('should remove the indicator when the animation finishes', async ({ skip }) => {
    if (isJSDOM) {
      skip();
    }

    globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

    let animationFinished = false;
    const notifyAnimationFinished = () => {
      animationFinished = true;
    };

    function Test() {
      const style = `
        @keyframes test-anim {
          to {
            opacity: 0;
          }
        }

        .animation-test-indicator[data-ending-style] {
          animation: test-anim 1ms;
        }
      `;

      const [checked, setChecked] = createSignal(true);

      return (
        <div>
          <style>{style}</style>
          <button onClick={() => setChecked(false)}>Close</button>
          <Checkbox.Root checked={checked()}>
            <Checkbox.Indicator
              class="animation-test-indicator"
              data-testid="indicator"
              onAnimationEnd={notifyAnimationFinished}
              keepMounted
            />
          </Checkbox.Root>
        </div>
      );
    }

    const { user } = render(() => <Test />);
    expect(screen.getByTestId('indicator')).not.to.equal(null);

    const closeButton = screen.getByText('Close');
    await user.click(closeButton);

    await waitFor(() => {
      expect(animationFinished).to.equal(true);
    });
  });

  describe.skipIf(isJSDOM)('animations', () => {
    // Solid layout: enter `data-starting-style` timing does not match Chromium 1.8.0 React.
    afterEach(() => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
    });

    it('triggers enter animation via data-starting-style when mounting', async () => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      let transitionFinished = false;
      function notifyTransitionFinished() {
        transitionFinished = true;
      }

      const style = `
        .animation-test-indicator {
          transition: opacity 1ms;
        }

        .animation-test-indicator[data-starting-style],
        .animation-test-indicator[data-ending-style] {
          opacity: 0;
        }
      `;

      function Test() {
        const [checked, setChecked] = createSignal(false);

        function handleCheck() {
          setChecked(true);
        }

        return (
          <div>
            <style>{style}</style>
            <button onClick={handleCheck}>Check</button>
            <Checkbox.Root checked={checked()}>
              <Checkbox.Indicator
                class="animation-test-indicator"
                data-testid="indicator"
                onTransitionEnd={notifyTransitionFinished}
              />
            </Checkbox.Root>
          </div>
        );
      }

      const { user } = render(() => <Test />);
      expect(screen.queryByTestId('indicator')).to.equal(null);

      await user.click(screen.getByText('Check'));

      await waitFor(() => {
        expect(transitionFinished).to.equal(true);
      });

      expect(screen.getByTestId('indicator')).not.to.equal(null);
    });

    it('applies data-ending-style before unmount', async () => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      const style = `
        @keyframes test-anim {
          to {
            opacity: 0;
          }
        }

        .animation-test-indicator[data-ending-style] {
          animation: test-anim 1ms;
        }
      `;

      function Test() {
        const [checked, setChecked] = createSignal(true);

        function handleUncheck() {
          setChecked(false);
        }

        return (
          <div>
            <style>{style}</style>
            <button onClick={handleUncheck}>Uncheck</button>
            <Checkbox.Root checked={checked()}>
              <Checkbox.Indicator class="animation-test-indicator" data-testid="indicator" />
            </Checkbox.Root>
          </div>
        );
      }

      const { user } = render(() => <Test />);
      expect(screen.getByTestId('indicator')).not.to.equal(null);

      await user.click(screen.getByText('Uncheck'));

      await waitFor(() => {
        const indicator = screen.queryByTestId('indicator');
        expect(indicator).not.to.equal(null);
        expect(indicator).to.have.attribute('data-ending-style');
      });

      await waitFor(() => {
        expect(screen.queryByTestId('indicator')).to.equal(null);
      });
    });

    it('removes all indicators in a single commit when multiple checkboxes are unchecked', async () => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      const style = `
        @keyframes test-anim {
          to {
            opacity: 0;
          }
        }

        .animation-test-indicator[data-ending-style] {
          animation: test-anim 1ms;
        }
      `;

      const indicatorCounts: number[] = [];

      function Test() {
        const [checked, setChecked] = createSignal(true);

        function handleUncheck() {
          setChecked(false);
        }

        return (
          <div>
            <style>{style}</style>
            <button onClick={handleUncheck}>Uncheck</button>
            <div>
              {Array.from({ length: 10 }, (_, index) => (
                <Checkbox.Root checked={checked()}>
                  <Checkbox.Indicator
                    class="animation-test-indicator"
                    data-testid={`indicator-${index}`}
                  />
                </Checkbox.Root>
              ))}
            </div>
          </div>
        );
      }

      const { user } = render(() => <Test />);

      // Solid: no `React.Profiler`; a mutation observer records the count after each DOM commit.
      const observer = new MutationObserver(() => {
        indicatorCounts.push(document.querySelectorAll('[data-testid^="indicator-"]').length);
      });
      observer.observe(document.body, { childList: true, subtree: true });

      try {
        await user.click(screen.getByText('Uncheck'));

        await waitFor(() => {
          expect(screen.queryByTestId('indicator-0')).to.equal(null);
        });
        expect(screen.queryByTestId('indicator-9')).to.equal(null);
      } finally {
        observer.disconnect();
      }

      expect(indicatorCounts).to.include(0);
      expect(indicatorCounts.every((count) => count === 0 || count === 10)).to.equal(true);
    });
  });
});
