import { expect, vi } from 'vitest';
import { createSignal, Show } from 'solid-js';
import { createRenderer, describeConformance, flushMicrotasks, isJSDOM } from '#test-utils';
import { Tooltip } from '@solidports/base-ui/tooltip';
import { screen, waitFor } from '@solidjs/testing-library';

// Solid: local copy of React's `#test-utils` helper.
async function waitForPositioned(positioner: HTMLElement) {
  await waitFor(() => {
    expect(positioner.style.opacity).not.to.equal('0');
  });
  await waitFor(() => {
    expect(positioner).toBeVisible();
  });
}

function Trigger(props: Tooltip.Trigger.Props) {
  return <Tooltip.Trigger {...props} ref={props.ref} render="div" />;
}

describe('<Tooltip.Positioner />', () => {
  const { render } = createRenderer();

  describeConformance(Tooltip.Positioner, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node, props) {
      return render(() => (
        <Tooltip.Root open>
          <Tooltip.Portal>{node(props!)}</Tooltip.Portal>
        </Tooltip.Root>
      ));
    },
  }));

  it('throws a descriptive error when rendered outside <Tooltip.Root>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      expect(() => render(() => <Tooltip.Positioner />)).to.throw(
        'Base UI: TooltipRootContext is missing. Tooltip parts must be placed within <Tooltip.Root>.',
      );
      await flushMicrotasks();
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it('throws a descriptive error when rendered outside <Tooltip.Portal>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      expect(() =>
        render(() => (
          <Tooltip.Root open>
            <Tooltip.Positioner />
          </Tooltip.Root>
        )),
      ).to.throw('Base UI: <Tooltip.Portal> is missing.');
      await flushMicrotasks();
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  const baselineX = 10;
  const baselineY = 36;
  const popupWidth = 52;
  const popupHeight = 24;
  const anchorWidth = 72;
  const anchorHeight = 36;
  const triggerStyle = { height: `${anchorHeight}px`, width: `${anchorWidth}px` };
  const popupStyle = { height: `${popupHeight}px`, width: `${popupWidth}px` };

  describe.skipIf(isJSDOM)('prop: sideOffset', () => {
    it('offsets the side when a number is specified', async () => {
      const sideOffset = 7;
      render(() => (
        <Tooltip.Root open>
          <Trigger style={triggerStyle}>Trigger</Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner data-testid="positioner" sideOffset={sideOffset}>
              <Tooltip.Popup style={popupStyle}>Popup</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      ));

      await waitFor(() => {
        expect(screen.getByTestId('positioner').getBoundingClientRect()).to.include({
          x: baselineX,
          y: baselineY + sideOffset,
        });
      });
    });

    it('offsets the side when a function is specified', async () => {
      render(() => (
        <Tooltip.Root open>
          <Trigger style={triggerStyle}>Trigger</Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner
              data-testid="positioner"
              sideOffset={(data) => data.positioner.width + data.anchor.width}
            >
              <Tooltip.Popup style={popupStyle}>Popup</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      ));

      await waitFor(() => {
        expect(screen.getByTestId('positioner').getBoundingClientRect()).to.include({
          x: baselineX,
          y: baselineY + popupWidth + anchorWidth,
        });
      });
    });

    it('can read the latest side inside sideOffset', async () => {
      let side = 'none';
      render(() => (
        <Tooltip.Root open>
          <Trigger style={triggerStyle}>Trigger</Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner
              side="left"
              data-testid="positioner"
              sideOffset={(data) => {
                side = data.side;
                return 0;
              }}
            >
              <Tooltip.Popup style={popupStyle}>Popup</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      ));

      // correctly flips the side in the browser
      await waitFor(() => {
        expect(side).to.equal('right');
      });
    });

    it('can read the latest align inside sideOffset', async () => {
      let align = 'none';
      render(() => (
        <Tooltip.Root open>
          <Trigger style={triggerStyle}>Trigger</Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner
              side="right"
              align="start"
              data-testid="positioner"
              sideOffset={(data) => {
                align = data.align;
                return 0;
              }}
            >
              <Tooltip.Popup style={popupStyle}>Popup</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      ));

      // correctly flips the align in the browser
      await waitFor(() => {
        expect(align).to.equal('end');
      });
    });

    it('reads logical side inside sideOffset', async () => {
      let side = 'none';
      render(() => (
        <Tooltip.Root open>
          <Trigger style={triggerStyle}>Trigger</Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner
              side="inline-start"
              data-testid="positioner"
              sideOffset={(data) => {
                side = data.side;
                return 0;
              }}
            >
              <Tooltip.Popup style={popupStyle}>Popup</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      ));

      // correctly flips the side in the browser
      await waitFor(() => {
        expect(side).to.equal('inline-end');
      });
    });
  });

  describe.skipIf(isJSDOM)('prop: alignOffset', () => {
    it('offsets the align when a number is specified', async () => {
      const alignOffset = 7;
      render(() => (
        <Tooltip.Root open>
          <Trigger style={triggerStyle}>Trigger</Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner data-testid="positioner" alignOffset={alignOffset}>
              <Tooltip.Popup style={popupStyle}>Popup</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      ));

      await waitFor(() => {
        expect(screen.getByTestId('positioner').getBoundingClientRect()).to.include({
          x: baselineX + alignOffset,
          y: baselineY,
        });
      });
    });

    it('offsets the align when a function is specified', async () => {
      render(() => (
        <Tooltip.Root open>
          <Trigger style={triggerStyle}>Trigger</Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner
              data-testid="positioner"
              alignOffset={(data) => data.positioner.width}
            >
              <Tooltip.Popup style={popupStyle}>Popup</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      ));

      await waitFor(() => {
        expect(screen.getByTestId('positioner').getBoundingClientRect()).to.include({
          x: baselineX + popupWidth,
          y: baselineY,
        });
      });
    });

    it('can read the latest side inside alignOffset', async () => {
      let side = 'none';
      render(() => (
        <Tooltip.Root open>
          <Trigger style={triggerStyle}>Trigger</Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner
              side="left"
              data-testid="positioner"
              alignOffset={(data) => {
                side = data.side;
                return 0;
              }}
            >
              <Tooltip.Popup style={popupStyle}>Popup</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      ));

      // correctly flips the side in the browser
      await waitFor(() => {
        expect(side).to.equal('right');
      });
    });

    it('can read the latest align inside alignOffset', async () => {
      let align = 'none';
      render(() => (
        <Tooltip.Root open>
          <Trigger style={triggerStyle}>Trigger</Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner
              side="right"
              align="start"
              data-testid="positioner"
              alignOffset={(data) => {
                align = data.align;
                return 0;
              }}
            >
              <Tooltip.Popup style={popupStyle}>Popup</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      ));

      // correctly flips the align in the browser
      await waitFor(() => {
        expect(align).to.equal('end');
      });
    });

    it('reads logical side inside alignOffset', async () => {
      let side = 'none';
      render(() => (
        <Tooltip.Root open>
          <Trigger style={triggerStyle}>Trigger</Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner
              side="inline-start"
              data-testid="positioner"
              alignOffset={(data) => {
                side = data.side;
                return 0;
              }}
            >
              <Tooltip.Popup style={popupStyle}>Popup</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      ));

      // correctly flips the side in the browser
      await waitFor(() => {
        expect(side).to.equal('inline-end');
      });
    });
  });

  it.skipIf(isJSDOM)('uses transform positioning without Viewport', async () => {
    const { unmount } = render(() => (
      <Tooltip.Root open>
        <Trigger style={triggerStyle}>Trigger</Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner data-testid="positioner">
            <Tooltip.Popup style={popupStyle}>Popup</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));

    const positioner = screen.getByTestId('positioner');
    await waitFor(() => {
      expect(positioner.style.transform).not.to.equal('');
    });
    unmount();
  });

  it.skipIf(isJSDOM)('uses top/left positioning with Viewport', async () => {
    const { unmount } = render(() => (
      <Tooltip.Root open>
        <Trigger style={triggerStyle}>Trigger</Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner data-testid="positioner">
            <Tooltip.Popup style={popupStyle}>
              <Tooltip.Viewport>Popup</Tooltip.Viewport>
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));

    const positioner = screen.getByTestId('positioner');
    await waitForPositioned(positioner);
    expect(positioner.style.transform).to.equal('');
    unmount();
  });

  it.skipIf(isJSDOM)('updates positioning when Viewport mounts and unmounts', async () => {
    function App() {
      const [showViewport, setShowViewport] = createSignal(false);

      return (
        <>
          <button onClick={() => setShowViewport((value) => !value)}>Toggle Viewport</button>
          <Tooltip.Root open>
            <Trigger style={triggerStyle}>Trigger</Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner data-testid="positioner">
                <Tooltip.Popup style={popupStyle}>
                  <Show when={showViewport()} fallback="Popup">
                    <Tooltip.Viewport>Popup</Tooltip.Viewport>
                  </Show>
                </Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </>
      );
    }

    const { user } = render(() => <App />);
    const positioner = screen.getByTestId('positioner');
    // Solid: React awaits `render`, which settles Floating UI's async positioning; wait for it.
    await waitForPositioned(positioner);

    expect(positioner.style.transform).not.to.equal('');

    await user.click(screen.getByRole('button', { name: 'Toggle Viewport' }));
    await waitFor(() => {
      expect(positioner.style.transform).to.equal('');
    });

    await user.click(screen.getByRole('button', { name: 'Toggle Viewport' }));
    await waitFor(() => {
      expect(positioner.style.transform).not.to.equal('');
    });
  });
});
