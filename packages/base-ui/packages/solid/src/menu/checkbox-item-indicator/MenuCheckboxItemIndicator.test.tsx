import { expect, vi } from 'vitest';
import { createRenderer, describeConformance, flushMicrotasks, isJSDOM } from '#test-utils';
import { Menu } from '@solidports/base-ui/menu';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

describe('<Menu.CheckboxItemIndicator />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  const { render } = createRenderer();

  describeConformance(
    (props) => <Menu.CheckboxItemIndicator keepMounted {...props} ref={props.ref} />,
    () => ({
      refInstanceof: window.HTMLSpanElement,
      render: (node, props) =>
        render(() => (
          <Menu.Root open>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.CheckboxItem>{node(props!)}</Menu.CheckboxItem>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        )),
    }),
  );

  it('throws when rendered outside Menu.CheckboxItem', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      expect(() => render(() => <Menu.CheckboxItemIndicator />)).to.throw(
        'Base UI: MenuCheckboxItemContext is missing. MenuCheckboxItem parts must be placed within <Menu.CheckboxItem>.',
      );
      await flushMicrotasks();
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
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
          <Menu.Root open modal={false}>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.CheckboxItem checked={checked()}>
                    <Menu.CheckboxItemIndicator data-testid="indicator" />
                  </Menu.CheckboxItem>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>
      );
    }

    const { user } = render(() => <Test />);

    expect(screen.queryByTestId('indicator')).not.to.equal(null);

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
          {/* eslint-disable-next-line solid/no-innerhtml */}
          <style innerHTML={style} />
          <button onClick={() => setChecked(false)}>Close</button>
          <Menu.Root open modal={false}>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.CheckboxItem checked={checked()}>
                    <Menu.CheckboxItemIndicator
                      class="animation-test-indicator"
                      data-testid="indicator"
                      keepMounted
                      onAnimationEnd={notifyAnimationFinished}
                    />
                  </Menu.CheckboxItem>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>
      );
    }

    const { user } = render(() => <Test />);

    expect(screen.getByTestId('indicator')).not.to.have.attribute('hidden');

    const closeButton = screen.getByText('Close');
    await user.click(closeButton);

    await waitFor(() => {
      expect(animationFinished).to.equal(true);
    });
  });

  it.skipIf(isJSDOM)(
    'keeps the indicator mounted to play its exit animation when unchecked without keepMounted',
    async () => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

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
            {/* eslint-disable-next-line solid/no-innerhtml */}
            <style innerHTML={style} />
            <button onClick={() => setChecked(false)}>Close</button>
            <Menu.Root open modal={false}>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.CheckboxItem checked={checked()}>
                      <Menu.CheckboxItemIndicator
                        class="animation-test-indicator"
                        data-testid="indicator"
                      />
                    </Menu.CheckboxItem>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </div>
        );
      }

      render(() => <Test />);

      expect(screen.getByTestId('indicator')).not.to.equal(null);

      fireEvent.click(screen.getByText('Close'));

      expect(screen.getByTestId('indicator')).to.have.attribute('data-ending-style');

      await waitFor(() => {
        expect(screen.queryByTestId('indicator')).to.equal(null);
      });
    },
  );
});
