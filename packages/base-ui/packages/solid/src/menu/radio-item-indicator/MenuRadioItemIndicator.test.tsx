import { expect, vi } from 'vitest';
import { createRenderer, describeConformance, flushMicrotasks, isJSDOM } from '#test-utils';
import { Menu } from '@solidports/base-ui/menu';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

describe('<Menu.RadioItemIndicator />', () => {
  const { render } = createRenderer();

  describeConformance(
    (props) => <Menu.RadioItemIndicator keepMounted {...props} ref={props.ref} />,
    () => ({
      refInstanceof: window.HTMLSpanElement,
      render: (node, props) =>
        render(() => (
          <Menu.Root open>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.RadioGroup>
                    <Menu.RadioItem value="">{node(props!)}</Menu.RadioItem>
                  </Menu.RadioGroup>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        )),
    }),
  );

  it('throws when rendered outside Menu.RadioItem', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      expect(() => render(() => <Menu.RadioItemIndicator />)).to.throw(
        'Base UI: MenuRadioItemContext is missing. MenuRadioItem parts must be placed within <Menu.RadioItem>.',
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
      const [value, setValue] = createSignal('a');
      return (
        <div>
          <button onClick={() => setValue('b')}>Close</button>
          <Menu.Root open modal={false}>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Popup>
                    <Menu.RadioGroup value={value()}>
                      <Menu.RadioItem value="a">
                        <Menu.RadioItemIndicator data-testid="indicator" />
                      </Menu.RadioItem>
                      <Menu.RadioItem value="b">
                        <Menu.RadioItemIndicator keepMounted />
                      </Menu.RadioItem>
                    </Menu.RadioGroup>
                  </Menu.Popup>
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

      const [value, setValue] = createSignal('a');

      return (
        <div>
          {/* eslint-disable-next-line solid/no-innerhtml */}
          <style innerHTML={style} />
          <button onClick={() => setValue('b')}>Close</button>
          <Menu.Root open modal={false}>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.RadioGroup value={value()}>
                    <Menu.RadioItem value="a">
                      <Menu.RadioItemIndicator
                        class="animation-test-indicator"
                        data-testid="indicator"
                        keepMounted
                        onAnimationEnd={notifyAnimationFinished}
                      />
                    </Menu.RadioItem>
                    <Menu.RadioItem value="b">
                      <Menu.RadioItemIndicator keepMounted />
                    </Menu.RadioItem>
                  </Menu.RadioGroup>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
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

        const [value, setValue] = createSignal('a');

        return (
          <div>
            {/* eslint-disable-next-line solid/no-innerhtml */}
            <style innerHTML={style} />
            <button onClick={() => setValue('b')}>Select b</button>
            <Menu.Root open modal={false}>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.RadioGroup value={value()}>
                      <Menu.RadioItem value="a">
                        <Menu.RadioItemIndicator
                          class="animation-test-indicator"
                          data-testid="indicator"
                        />
                      </Menu.RadioItem>
                      <Menu.RadioItem value="b">
                        <Menu.RadioItemIndicator />
                      </Menu.RadioItem>
                    </Menu.RadioGroup>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </div>
        );
      }

      render(() => <Test />);

      expect(screen.getByTestId('indicator')).not.to.equal(null);

      fireEvent.click(screen.getByText('Select b'));

      expect(screen.getByTestId('indicator')).to.have.attribute('data-ending-style');

      await waitFor(() => {
        expect(screen.queryByTestId('indicator')).to.equal(null);
      });
    },
  );
});
