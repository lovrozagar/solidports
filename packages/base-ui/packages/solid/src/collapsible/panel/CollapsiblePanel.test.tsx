import { expect, vi, describe, it } from 'vitest';
import { createRenderEffect, createSignal } from 'solid-js';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { Collapsible } from '@solidports/base-ui/collapsible';
import { act, createRenderer, describeConformance, flushMicrotasks, isJSDOM } from '#test-utils';
import { REASONS } from '../../utils/reasons';
import { AnimationFrame } from '../../utils/useAnimationFrame';
import { Activity } from '../../../test/activity';
import { renderServer } from '../../../test/ssrFixtures';
import fixtures from './CollapsiblePanel.ssr-fixtures';

const PANEL_CONTENT = 'This is panel content';

function fireBeforeMatch(element: Element) {
  fireEvent(
    element,
    new window.Event('beforematch', {
      bubbles: true,
      cancelable: false,
    }),
  );
}

function waitForAnimationFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
}

describe('<Collapsible.Panel />', () => {
  const { render } = createRenderer();

  describeConformance(Collapsible.Panel, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node, props) => {
      return render(() => <Collapsible.Root defaultOpen>{node(props!)}</Collapsible.Root>);
    },
  }));

  it('warns when hiddenUntilFound overrides keepMounted={false}', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      await render(() => (
        <Collapsible.Root>
          <Collapsible.Panel hiddenUntilFound keepMounted={false}>
            {PANEL_CONTENT}
          </Collapsible.Panel>
        </Collapsible.Root>
      ));

      expect(warnSpy).toHaveBeenCalledWith(
        'Base UI: The `keepMounted={false}` prop on `Collapsible.Panel` is ignored when `hiddenUntilFound` is enabled, since the panel must remain mounted while closed.',
      );
      expect(screen.getByText(PANEL_CONTENT).getAttribute('hidden')).toBe('until-found');
    } finally {
      warnSpy.mockRestore();
    }
  });

  // Solid: static props are checked once at setup (no node); reactive ones keep re-checking.
  it('warns when a reactive hiddenUntilFound starts overriding keepMounted={false}', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const [hiddenUntilFound, setHiddenUntilFound] = createSignal(false);

    try {
      await render(() => (
        <Collapsible.Root>
          <Collapsible.Panel hiddenUntilFound={hiddenUntilFound()} keepMounted={false}>
            {PANEL_CONTENT}
          </Collapsible.Panel>
        </Collapsible.Root>
      ));
      expect(warnSpy).not.toHaveBeenCalled();

      await act(() => setHiddenUntilFound(true));
      expect(warnSpy).toHaveBeenCalledWith(
        'Base UI: The `keepMounted={false}` prop on `Collapsible.Panel` is ignored when `hiddenUntilFound` is enabled, since the panel must remain mounted while closed.',
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  describe('prop: keepMounted', () => {
    it('does not unmount the panel when true', async () => {
      function App() {
        const [open, setOpen] = createSignal(false);
        return (
          <Collapsible.Root open={open()} onOpenChange={setOpen}>
            <Collapsible.Trigger />
            <Collapsible.Panel keepMounted>{PANEL_CONTENT}</Collapsible.Panel>
          </Collapsible.Root>
        );
      }

      await render(() => <App />);

      const trigger = screen.getByRole('button');

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT)).not.toBe(null);
      expect(screen.queryByText(PANEL_CONTENT)).not.toBeVisible();
      expect(screen.queryByText(PANEL_CONTENT)).toHaveAttribute('data-closed');

      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger.getAttribute('aria-controls')).toBe(
        screen.queryByText(PANEL_CONTENT)?.getAttribute('id'),
      );
      expect(screen.queryByText(PANEL_CONTENT)).toBeVisible();
      expect(screen.queryByText(PANEL_CONTENT)).toHaveAttribute('data-open');
      expect(trigger).toHaveAttribute('data-panel-open');

      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger.getAttribute('aria-controls')).toBe(null);
      expect(screen.queryByText(PANEL_CONTENT)).not.toBeVisible();
      expect(screen.queryByText(PANEL_CONTENT)).toHaveAttribute('data-closed');
    });

    it.skipIf(isJSDOM)(
      'hides the panel after external controlled close when true and no animations are applied',
      async () => {
        function App() {
          const [open, setOpen] = createSignal(false);

          return (
            <>
              <Collapsible.Root open={open()} onOpenChange={setOpen}>
                <Collapsible.Trigger>Trigger</Collapsible.Trigger>
                <Collapsible.Panel keepMounted>{PANEL_CONTENT}</Collapsible.Panel>
              </Collapsible.Root>

              <button type="button" onClick={() => setOpen(!open())}>
                toggle externally
              </button>
            </>
          );
        }

        const { user } = await render(() => <App />);

        const trigger = screen.getByRole('button', { name: 'Trigger' });
        const externalTrigger = screen.getByRole('button', { name: 'toggle externally' });
        const panel = screen.getByText(PANEL_CONTENT);

        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(panel).toHaveAttribute('hidden');
        expect(panel).toHaveAttribute('data-closed');
        expect(panel).not.toHaveAttribute('data-ending-style');

        await user.click(externalTrigger);

        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        expect(panel).not.toHaveAttribute('hidden');
        expect(panel).toHaveAttribute('data-open');

        await user.click(externalTrigger);

        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(panel).toHaveAttribute('hidden');
        expect(panel).toHaveAttribute('data-closed');
        expect(panel).not.toHaveAttribute('data-ending-style');
      },
    );
  });

  it('unmounts a panel that mounts after the close has already entered the ending phase', async () => {
    const renderedStatuses: Array<Collapsible.Panel.State['transitionStatus']> = [];

    await render(() => (
      <Collapsible.Root defaultOpen>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
        <Collapsible.Panel
          render={(props, state) => {
            // Solid: the render function re-runs for the state it reads, as React re-renders.
            renderedStatuses.push(state.transitionStatus);

            if (!state.open && state.transitionStatus !== 'ending') {
              return null;
            }

            return <div {...props} />;
          }}
        >
          {PANEL_CONTENT}
        </Collapsible.Panel>
      </Collapsible.Root>
    ));

    fireEvent.click(screen.getByRole('button', { name: 'Trigger' }));

    await act(async () => {
      await waitForAnimationFrame();
    });

    expect(renderedStatuses).toContain('ending');
    expect(screen.queryByText(PANEL_CONTENT)).toBe(null);
  });

  describe.skipIf(isJSDOM)('CSS transitions', () => {
    it('applies data-starting-style while opening', async () => {
      await render(() => (
        <>
          <style>{`
            .transition-test-panel {
              overflow: hidden;
              height: var(--collapsible-panel-height);
              transition: height 100ms linear;
            }

            .transition-test-panel[data-starting-style],
            .transition-test-panel[data-ending-style] {
              height: 0;
            }
          `}</style>

          <Collapsible.Root>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel class="transition-test-panel" data-testid="panel">
              {PANEL_CONTENT}
            </Collapsible.Panel>
          </Collapsible.Root>
        </>
      ));

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      // Keep this synchronous so the transient starting-style render is observable.
      fireEvent.click(trigger);

      const panel = screen.getByTestId('panel');

      expect(panel).toHaveAttribute('data-starting-style');
      expect(panel).toHaveAttribute('data-open');
    });

    it('restores a measured height before applying closing transition styles', async () => {
      const { user } = await render(() => (
        <>
          <style>{`
            .transition-test-panel {
              overflow: hidden;
              height: var(--collapsible-panel-height);
              transition: height 100ms linear;
            }

            .transition-test-panel[data-ending-style] {
              height: 0;
            }
          `}</style>

          <Collapsible.Root defaultOpen>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel class="transition-test-panel" data-testid="panel">
              {PANEL_CONTENT}
            </Collapsible.Panel>
          </Collapsible.Root>
        </>
      ));

      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const panel = screen.getByTestId('panel');

      await waitFor(() => {
        expect(panel.style.getPropertyValue('--collapsible-panel-height')).toBe('auto');
      });

      await user.click(trigger);

      // Both hold only mid-transition, so check them in one snapshot.
      await waitFor(() => {
        expect({
          endingStyle: panel.hasAttribute('data-ending-style'),
          height: panel.style.getPropertyValue('--collapsible-panel-height'),
        }).toEqual({ endingStyle: true, height: expect.stringMatching(/px$/) });
      });
    });

    it('unmounts a zero-size panel without waiting for unrelated transitions', async () => {
      await render(() => (
        <>
          <style>{`
            .zero-size-panel {
              overflow: hidden;
              width: 0;
              height: 0;
              opacity: 1;
              transition: opacity 10s linear;
            }

            .zero-size-panel[data-ending-style] {
              opacity: 0;
            }
          `}</style>

          <Collapsible.Root defaultOpen>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel class="zero-size-panel" data-testid="panel" />
          </Collapsible.Root>
        </>
      ));

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      expect(screen.getByTestId('panel')).toHaveAttribute('data-open');

      fireEvent.click(trigger);
      await act(async () => {
        await waitForAnimationFrame();
      });

      expect(screen.queryByTestId('panel')).toBe(null);
    });

    it('finishes closing when the render function removes the panel element', async () => {
      const onOpenChange = vi.fn();

      const { user } = await render(() => (
        <Collapsible.Root defaultOpen onOpenChange={onOpenChange}>
          <Collapsible.Trigger>Trigger</Collapsible.Trigger>
          <Collapsible.Panel
            render={(props, state) => (state.open ? <div {...props} /> : null)}
            style={{ transition: 'height 100ms linear' }}
          >
            {PANEL_CONTENT}
          </Collapsible.Panel>
        </Collapsible.Root>
      ));

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      expect(screen.getByText(PANEL_CONTENT)).toHaveAttribute('data-open');

      await user.click(trigger);
      await act(async () => {
        await waitForAnimationFrame();
      });

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT)).toBe(null);
      expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
      // Closing settles even though no element is left to animate.
      expect(trigger).not.toHaveAttribute('data-ending-style');
    });

    it('preserves inline alignment styles while measuring an opening panel', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      try {
        await render(() => (
          <>
            <style>{`
              @keyframes panel-fade-in {
                from {
                  opacity: 0;
                }

                to {
                  opacity: 1;
                }
              }

              .mixed-motion-panel {
                height: var(--collapsible-panel-height);
                transition: height 100ms linear;
                animation: panel-fade-in 100ms linear;
              }

              .mixed-motion-panel[data-starting-style] {
                height: 0;
              }
            `}</style>

            <Collapsible.Root>
              <Collapsible.Trigger>Trigger</Collapsible.Trigger>
              <Collapsible.Panel
                class="mixed-motion-panel"
                data-testid="panel"
                keepMounted
                style={{ 'justify-content': 'center' }}
              >
                {PANEL_CONTENT}
              </Collapsible.Panel>
            </Collapsible.Root>
          </>
        ));

        const trigger = screen.getByRole('button', { name: 'Trigger' });
        const panel = screen.getByTestId('panel');

        fireEvent.click(trigger);

        expect(panel).toHaveAttribute('data-starting-style');
        expect(panel.style.getPropertyValue('justify-content')).toBe('initial');
        expect(panel.style.getPropertyPriority('justify-content')).toBe('important');
        expect(warnSpy).toHaveBeenCalledWith(
          'Base UI: CSS transitions and CSS animations both detected on Collapsible or Accordion panel. Only one of either animation type should be used.',
        );

        await act(async () => {
          await waitForAnimationFrame();
        });

        expect(panel.style.justifyContent).toBe('center');
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('keeps exit transitions working after a close is interrupted by reopening', async () => {
      // Keep the close running long enough for a slow run to interrupt it. Without animations,
      // `data-ending-style` only lasts a frame and `waitFor` can miss it.
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;
      const { user } = await render(() => (
        <>
          <style>{`
            .interruptible-panel {
              overflow: hidden;
              height: var(--collapsible-panel-height);
              transition: height 10s linear;
            }

            .interruptible-panel[data-starting-style],
            .interruptible-panel[data-ending-style] {
              height: 0;
            }
          `}</style>

          <Collapsible.Root defaultOpen>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel class="interruptible-panel" data-testid="panel">
              {PANEL_CONTENT}
            </Collapsible.Panel>
          </Collapsible.Root>
        </>
      ));

      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const panel = screen.getByTestId('panel');

      await user.click(trigger);

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-ending-style');
      });

      await user.click(trigger);

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-open');
      });
      await waitFor(() => {
        expect(panel).not.toHaveAttribute('data-starting-style');
      });

      fireEvent.click(trigger);

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-ending-style');
      });
      expect(screen.getByTestId('panel')).toBe(panel);
    });

    it('keeps the measured size when an open animation finishes during a close commit', async () => {
      const animationsDisabled = globalThis.BASE_UI_ANIMATIONS_DISABLED;
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;
      const abortSpy = vi.spyOn(AbortController.prototype, 'abort').mockImplementation(() => {});
      let animationStarted = false;
      const animation = new Animation(new KeyframeEffect(null, [], 10_000), document.timeline);
      animation.play();

      function ResolveAnimationOnClose(props: { open: boolean }) {
        createRenderEffect(
          () => props.open,
          (open) => {
            if (!open && animationStarted) {
              animation.finish();
            }
          },
        );

        return null;
      }

      const setPanelRef = (node: HTMLDivElement | null) => {
        if (node) {
          node.getAnimations = () => {
            if (node.hasAttribute('data-open')) {
              animationStarted = true;
              return [animation];
            }

            return [];
          };
        }
      };

      try {
        await render(() => (
          <Collapsible.Root defaultOpen>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel
              ref={setPanelRef}
              keepMounted
              render={(props, state) => (
                <div {...props}>
                  <ResolveAnimationOnClose open={state.open} />
                  {props.children}
                </div>
              )}
              style={{ transition: 'height 10s linear' }}
            >
              {PANEL_CONTENT}
            </Collapsible.Panel>
          </Collapsible.Root>
        ));

        const panel = screen.getByText(PANEL_CONTENT);

        await act(async () => {
          await waitForAnimationFrame();
        });
        expect(animationStarted).toBe(true);

        fireEvent.click(screen.getByRole('button', { name: 'Trigger' }));
        await flushMicrotasks();

        expect(panel.style.getPropertyValue('--collapsible-panel-height')).toMatch(/px$/);
      } finally {
        animation.cancel();
        abortSpy.mockRestore();
        globalThis.BASE_UI_ANIMATIONS_DISABLED = animationsDisabled;
      }
    });

    it('does not restart the entrance transition when a close animation finishes after reopening', async () => {
      const animationsDisabled = globalThis.BASE_UI_ANIMATIONS_DISABLED;
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;
      const abortSpy = vi.spyOn(AbortController.prototype, 'abort').mockImplementation(() => {});
      let closeAnimationStarted = false;
      const closeAnimation = new Animation(new KeyframeEffect(null, [], 10_000), document.timeline);
      closeAnimation.play();

      const setPanelRef = (node: HTMLDivElement | null) => {
        if (node) {
          node.getAnimations = () => {
            if (node.hasAttribute('data-ending-style')) {
              closeAnimationStarted = true;
              return [closeAnimation];
            }

            return [];
          };
        }
      };

      try {
        await render(() => (
          <Collapsible.Root defaultOpen>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel ref={setPanelRef} style={{ transition: 'height 10s linear' }}>
              {PANEL_CONTENT}
            </Collapsible.Panel>
          </Collapsible.Root>
        ));

        const trigger = screen.getByRole('button', { name: 'Trigger' });
        const panel = screen.getByText(PANEL_CONTENT);

        fireEvent.click(trigger);
        await waitFor(() => {
          expect(closeAnimationStarted).toBe(true);
        });

        fireEvent.click(trigger);
        await waitFor(() => {
          expect(panel).toHaveAttribute('data-open');
        });
        await waitFor(() => {
          expect(panel).not.toHaveAttribute('data-starting-style');
        });

        closeAnimation.finish();
        await flushMicrotasks();

        expect(panel).toHaveAttribute('data-open');
        expect(panel).not.toHaveAttribute('data-starting-style');
        expect(screen.getByText(PANEL_CONTENT)).toBe(panel);
      } finally {
        closeAnimation.cancel();
        abortSpy.mockRestore();
        globalThis.BASE_UI_ANIMATIONS_DISABLED = animationsDisabled;
      }
    });
  });

  describe.skipIf(isJSDOM)('CSS animations', () => {
    it('does not run the mount animation when initially open', async () => {
      await render(() => (
        <>
          <style>{`
            @keyframes panel-slide-down {
              from {
                height: 0;
              }

              to {
                height: var(--collapsible-panel-height);
              }
            }

            .animation-test-panel[data-open] {
              overflow: hidden;
              animation: panel-slide-down 100ms linear;
            }
          `}</style>

          <Collapsible.Root defaultOpen>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel class="animation-test-panel" data-testid="panel">
              {PANEL_CONTENT}
            </Collapsible.Panel>
          </Collapsible.Root>
        </>
      ));

      const panel = screen.getByTestId('panel');

      expect(panel).toHaveAttribute('data-open');
      expect(panel.getAnimations().length).toBe(0);
      expect(getComputedStyle(panel).animationName).toBe('none');
    });

    it('animates on reopen after an initially open panel is removed by the render function', async () => {
      const { user } = await render(() => (
        <>
          <style>{`
            @keyframes removable-panel-open {
              from {
                opacity: 0;
              }

              to {
                opacity: 1;
              }
            }

            .removable-animation-panel[data-open] {
              animation: removable-panel-open 10s linear;
            }
          `}</style>

          <Collapsible.Root defaultOpen>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel
              class="removable-animation-panel"
              data-testid="panel"
              render={(props, state) => (state.open ? <div {...props} /> : null)}
            >
              {PANEL_CONTENT}
            </Collapsible.Panel>
          </Collapsible.Root>
        </>
      ));

      const trigger = screen.getByRole('button', { name: 'Trigger' });
      expect(screen.getByTestId('panel').getAnimations().length).toBe(0);

      await user.click(trigger);

      expect(screen.queryByTestId('panel')).toBe(null);

      await user.click(trigger);

      const panel = screen.getByTestId('panel');
      expect(panel).toHaveAttribute('data-open');
      expect(getComputedStyle(panel).animationName).toBe('removable-panel-open');
      expect(panel.getAnimations().length).toBe(1);
    });

    it('still animates on close and reopen after being initially open', async () => {
      const { user } = await render(() => (
        <>
          <style>{`
            @keyframes panel-slide-down {
              from {
                height: 0;
              }

              to {
                height: var(--collapsible-panel-height);
              }
            }

            @keyframes panel-slide-up {
              from {
                height: var(--collapsible-panel-height);
              }

              to {
                height: 0;
              }
            }

            .animation-test-panel[data-open] {
              overflow: hidden;
              animation: panel-slide-down 100ms linear;
            }

            .animation-test-panel[data-closed] {
              overflow: hidden;
              animation: panel-slide-up 100ms linear;
            }
          `}</style>

          <Collapsible.Root defaultOpen>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel class="animation-test-panel" data-testid="panel" keepMounted>
              {PANEL_CONTENT}
            </Collapsible.Panel>
          </Collapsible.Root>
        </>
      ));

      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const panel = screen.getByTestId('panel');

      expect(panel.getAnimations().length).toBe(0);

      await user.click(trigger);

      // The animation runs only while the panel is closing, so check both in one snapshot.
      await waitFor(() => {
        expect({
          closed: panel.hasAttribute('data-closed'),
          animations: panel.getAnimations().length,
        }).toEqual({ closed: true, animations: 1 });
      });

      await user.click(trigger);

      // The animation runs only while the panel is opening, so check both in one snapshot.
      await waitFor(() => {
        expect({
          open: panel.hasAttribute('data-open'),
          animations: panel.getAnimations().length,
        }).toEqual({ open: true, animations: 1 });
      });
    });

    it('restores measured dimensions before applying a closing keyframe animation', async () => {
      const { user } = await render(() => (
        <>
          <style>{`
            @keyframes panel-slide-up {
              from {
                height: var(--collapsible-panel-height);
              }

              to {
                height: 0;
              }
            }

            .closing-animation-panel[data-closed] {
              overflow: hidden;
              animation: panel-slide-up 100ms linear;
            }
          `}</style>

          <Collapsible.Root defaultOpen>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel class="closing-animation-panel" data-testid="panel">
              {PANEL_CONTENT}
            </Collapsible.Panel>
          </Collapsible.Root>
        </>
      ));

      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const panel = screen.getByTestId('panel');

      await waitFor(() => {
        expect(panel.style.getPropertyValue('--collapsible-panel-height')).toBe('auto');
      });

      await user.click(trigger);

      // All three hold only while the closing animation runs, so check them in one snapshot.
      await waitFor(() => {
        expect({
          endingStyle: panel.hasAttribute('data-ending-style'),
          height: panel.style.getPropertyValue('--collapsible-panel-height'),
          animations: panel.getAnimations().length,
        }).toEqual({ endingStyle: true, height: expect.stringMatching(/px$/), animations: 1 });
      });
    });

    it('still animates on reopen after being initially open when only open keyframes are defined', async () => {
      const { user } = await render(() => (
        <>
          <style>{`
            @keyframes panel-slide-down {
              from {
                height: 0;
              }

              to {
                height: var(--collapsible-panel-height);
              }
            }

            .animation-test-panel[data-open] {
              overflow: hidden;
              animation: panel-slide-down 100ms linear;
            }
          `}</style>

          <Collapsible.Root defaultOpen>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel class="animation-test-panel" data-testid="panel" keepMounted>
              {PANEL_CONTENT}
            </Collapsible.Panel>
          </Collapsible.Root>
        </>
      ));

      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const panel = screen.getByTestId('panel');

      expect(panel.getAnimations().length).toBe(0);

      await user.click(trigger);

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-closed');
      });

      await user.click(trigger);

      // The animation runs only while the panel is opening, so check both in one snapshot.
      await waitFor(() => {
        expect({
          open: panel.hasAttribute('data-open'),
          animations: panel.getAnimations().length,
        }).toEqual({ open: true, animations: 1 });
      });
    });
  });

  describe('server-side rendering', () => {
    it('suppresses the initial keyframe animation when rendered open', async () => {
      renderServer(fixtures, 'keyframes');

      expect(screen.getByTestId('panel').style.animationName).toBe('none');
    });

    it('suppresses the initial keyframe animation from inline styles when rendered open', async () => {
      renderServer(fixtures, 'inlineKeyframes');

      const panel = screen.getByTestId('panel');

      expect(panel.style.animationName).toBe('none');
      expect(panel.style.animationDuration).toBe('100ms');
    });
  });

  // Solid: `Activity` (test/activity.tsx) hides its content as React's does in the DOM
  // (`display: none !important`); Solid keeps the hidden panel's effects running.
  describe.skipIf(isJSDOM)('React.Activity', () => {
    function getActivity() {
      return Activity;
    }

    it('does not replay open transitions when revealing an initially open panel', async () => {
      const ActivityComponent = getActivity();

      function App() {
        const [visible, setVisible] = createSignal(true);

        return (
          <>
            <style>{`
              .transition-test-panel {
                overflow: hidden;
                height: var(--collapsible-panel-height);
                transition: height 100ms linear;
              }

              .transition-test-panel[data-starting-style],
              .transition-test-panel[data-ending-style] {
                height: 0;
              }
            `}</style>

            <button type="button" onClick={() => setVisible((prev) => !prev)}>
              toggle activity
            </button>

            <ActivityComponent mode={visible() ? 'visible' : 'hidden'}>
              <Collapsible.Root defaultOpen>
                <Collapsible.Trigger>Trigger</Collapsible.Trigger>
                <Collapsible.Panel class="transition-test-panel" data-testid="panel">
                  {PANEL_CONTENT}
                </Collapsible.Panel>
              </Collapsible.Root>
            </ActivityComponent>
          </>
        );
      }

      const { user } = await render(() => <App />);

      const toggle = screen.getByRole('button', { name: 'toggle activity' });
      const panel = screen.getByTestId('panel');
      let transitionRuns = 0;

      panel.addEventListener('transitionrun', () => {
        transitionRuns += 1;
      });

      await waitFor(() => {
        expect(panel.style.getPropertyValue('--collapsible-panel-height')).toBe('auto');
      });

      transitionRuns = 0;

      await user.click(toggle);
      await user.click(toggle);

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-open');
      });

      expect(transitionRuns).toBe(0);
    });

    it('does not replay open transitions when revealing a panel opened by the user', async () => {
      // Wait for the initial opening transition before checking for Activity replays.
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;
      const ActivityComponent = getActivity();

      function App() {
        const [visible, setVisible] = createSignal(true);

        return (
          <>
            <style>{`
              .transition-test-panel {
                overflow: hidden;
                height: var(--collapsible-panel-height);
                transition: height 100ms linear;
              }

              .transition-test-panel[data-starting-style],
              .transition-test-panel[data-ending-style] {
                height: 0;
              }
            `}</style>

            <button type="button" onClick={() => setVisible((prev) => !prev)}>
              toggle activity
            </button>

            <ActivityComponent mode={visible() ? 'visible' : 'hidden'}>
              <Collapsible.Root>
                <Collapsible.Trigger>Trigger</Collapsible.Trigger>
                <Collapsible.Panel class="transition-test-panel" data-testid="panel" keepMounted>
                  {PANEL_CONTENT}
                </Collapsible.Panel>
              </Collapsible.Root>
            </ActivityComponent>
          </>
        );
      }

      const { user } = await render(() => <App />);

      const toggle = screen.getByRole('button', { name: 'toggle activity' });
      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const panel = screen.getByTestId('panel');
      let transitionRuns = 0;

      panel.addEventListener('transitionrun', () => {
        transitionRuns += 1;
      });

      await user.click(trigger);

      // The height switches to auto once the opening transition ends.
      await waitFor(() => {
        expect(panel.style.getPropertyValue('--collapsible-panel-height')).toBe('auto');
      });
      expect(panel).toHaveAttribute('data-open');

      transitionRuns = 0;

      await user.click(toggle);
      await user.click(toggle);

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-open');
      });

      expect(transitionRuns).toBe(0);
    });

    it('does not replay open keyframe animations when revealing an initially open panel', async () => {
      const ActivityComponent = getActivity();

      function App() {
        const [visible, setVisible] = createSignal(true);

        return (
          <>
            <style>{`
              @keyframes panel-slide-down {
                from {
                  height: 0;
                }

                to {
                  height: var(--collapsible-panel-height);
                }
              }

              .animation-test-panel[data-open] {
                overflow: hidden;
                animation: panel-slide-down 100ms linear;
              }
            `}</style>

            <button type="button" onClick={() => setVisible((prev) => !prev)}>
              toggle activity
            </button>

            <ActivityComponent mode={visible() ? 'visible' : 'hidden'}>
              <Collapsible.Root defaultOpen>
                <Collapsible.Trigger>Trigger</Collapsible.Trigger>
                <Collapsible.Panel class="animation-test-panel" data-testid="panel" keepMounted>
                  {PANEL_CONTENT}
                </Collapsible.Panel>
              </Collapsible.Root>
            </ActivityComponent>
          </>
        );
      }

      const { user } = await render(() => <App />);

      const toggle = screen.getByRole('button', { name: 'toggle activity' });
      const panel = screen.getByTestId('panel');

      await waitFor(() => {
        expect(panel.getAnimations().length).toBe(0);
      });

      await user.click(toggle);
      await user.click(toggle);

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-open');
      });

      expect(panel.getAnimations().length).toBe(0);
    });

    it('does not replay open keyframe animations when revealing a panel opened by the user', async () => {
      const ActivityComponent = getActivity();

      function App() {
        const [visible, setVisible] = createSignal(true);

        return (
          <>
            <style>{`
              @keyframes panel-slide-down {
                from {
                  height: 0;
                }

                to {
                  height: var(--collapsible-panel-height);
                }
              }

              .animation-test-panel[data-open] {
                overflow: hidden;
                animation: panel-slide-down 100ms linear;
              }
            `}</style>

            <button type="button" onClick={() => setVisible((prev) => !prev)}>
              toggle activity
            </button>

            <ActivityComponent mode={visible() ? 'visible' : 'hidden'}>
              <Collapsible.Root>
                <Collapsible.Trigger>Trigger</Collapsible.Trigger>
                <Collapsible.Panel class="animation-test-panel" data-testid="panel" keepMounted>
                  {PANEL_CONTENT}
                </Collapsible.Panel>
              </Collapsible.Root>
            </ActivityComponent>
          </>
        );
      }

      const { user } = await render(() => <App />);

      const toggle = screen.getByRole('button', { name: 'toggle activity' });
      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const panel = screen.getByTestId('panel');

      await user.click(trigger);

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-open');
      });

      await waitFor(() => {
        expect(panel.getAnimations().length).toBe(0);
      });

      await user.click(toggle);
      await user.click(toggle);

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-open');
      });

      expect(panel.getAnimations().length).toBe(0);
    });

    it('does not replay open keyframe animations from inline styles when revealing a panel opened by the user', async () => {
      const ActivityComponent = getActivity();

      function App() {
        const [visible, setVisible] = createSignal(true);

        return (
          <>
            <style>{`
              @keyframes panel-slide-down {
                from {
                  height: 0;
                }

                to {
                  height: var(--collapsible-panel-height);
                }
              }
            `}</style>

            <button type="button" onClick={() => setVisible((prev) => !prev)}>
              toggle activity
            </button>

            <ActivityComponent mode={visible() ? 'visible' : 'hidden'}>
              <Collapsible.Root>
                <Collapsible.Trigger>Trigger</Collapsible.Trigger>
                <Collapsible.Panel
                  data-testid="panel"
                  keepMounted
                  style={{
                    'animation-duration': '100ms',
                    'animation-name': 'panel-slide-down',
                    'animation-timing-function': 'linear',
                    overflow: 'hidden',
                  }}
                >
                  {PANEL_CONTENT}
                </Collapsible.Panel>
              </Collapsible.Root>
            </ActivityComponent>
          </>
        );
      }

      const { user } = await render(() => <App />);

      const toggle = screen.getByRole('button', { name: 'toggle activity' });
      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const panel = screen.getByTestId('panel');

      await user.click(trigger);

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-open');
      });

      await waitFor(() => {
        expect(panel.getAnimations().length).toBe(0);
      });

      await user.click(toggle);
      await user.click(toggle);

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-open');
      });

      expect(panel.getAnimations().length).toBe(0);
    });
  });

  describe.skipIf(isJSDOM || !('onbeforematch' in window))('interrupted beforematch opens', () => {
    it('keeps the temporary zero animation duration until the panel closes', async () => {
      function App() {
        return (
          <>
            <style>{`
                @keyframes panel-slide-down {
                  from {
                    height: 0;
                  }

                  to {
                    height: var(--collapsible-panel-height);
                  }
                }

                @keyframes panel-slide-up {
                  from {
                    height: var(--collapsible-panel-height);
                  }

                  to {
                    height: 0;
                  }
                }

                .animation-test-panel {
                  overflow: hidden;
                  animation-duration: 123ms;
                }

                .animation-test-panel[data-open] {
                  animation-name: panel-slide-down;
                }

                .animation-test-panel[data-closed] {
                  animation-name: panel-slide-up;
                }
              `}</style>

            <Collapsible.Root>
              <Collapsible.Trigger>Trigger</Collapsible.Trigger>
              <Collapsible.Panel
                class="animation-test-panel"
                data-testid="panel"
                hiddenUntilFound
                keepMounted
              >
                {PANEL_CONTENT}
              </Collapsible.Panel>
            </Collapsible.Root>
          </>
        );
      }

      const { user } = await render(() => <App />);

      const panel = screen.getByTestId('panel');
      const trigger = screen.getByRole('button', { name: 'Trigger' });

      fireBeforeMatch(panel);

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-open');
      });

      await act(async () => {
        await waitForAnimationFrame();
        await waitForAnimationFrame();
      });

      expect(getComputedStyle(panel).animationDuration).toBe('0s');

      await user.click(trigger);

      // The animation runs only while the panel is closing, so check both in one snapshot.
      await waitFor(() => {
        expect({
          closed: panel.hasAttribute('data-closed'),
          animations: panel.getAnimations().length,
        }).toEqual({ closed: true, animations: 1 });
      });

      expect(getComputedStyle(panel).animationDuration).toBe('0.123s');
    });

    it('restores the transition duration before the first close after a beforematch open', async () => {
      function App() {
        return (
          <>
            <style>{`
                .transition-test-panel {
                  overflow: hidden;
                  height: var(--collapsible-panel-height);
                  transition-property: height;
                  transition-duration: 999ms;
                  transition-timing-function: linear;
                }

                .transition-test-panel[data-starting-style],
                .transition-test-panel[data-ending-style] {
                  height: 0;
                }
              `}</style>

            <Collapsible.Root>
              <Collapsible.Trigger>Trigger</Collapsible.Trigger>
              <Collapsible.Panel
                class="transition-test-panel"
                data-testid="panel"
                hiddenUntilFound
                keepMounted
                style={{ 'transition-duration': '123ms' }}
              >
                {PANEL_CONTENT}
              </Collapsible.Panel>
            </Collapsible.Root>
          </>
        );
      }

      const { user } = await render(() => <App />);

      const panel = screen.getByTestId('panel');
      const trigger = screen.getByRole('button', { name: 'Trigger' });

      fireBeforeMatch(panel);

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-open');
      });

      await act(async () => {
        await waitForAnimationFrame();
        await waitForAnimationFrame();
      });

      expect(getComputedStyle(panel).transitionDuration).toBe('0s');

      await user.click(trigger);

      // All three hold only while the closing transition runs, so check them in one snapshot.
      await waitFor(() => {
        expect({
          endingStyle: panel.hasAttribute('data-ending-style'),
          transitionDuration: panel.style.transitionDuration,
          animations: panel.getAnimations().length,
        }).toEqual({ endingStyle: true, transitionDuration: '123ms', animations: 1 });
      });
    });

    it('does not suppress a later animated open after a no-motion beforematch open', async () => {
      function App() {
        const [motionEnabled, setMotionEnabled] = createSignal(false);

        return (
          <>
            <style>{`
              .transition-test-panel {
                overflow: hidden;
                height: var(--collapsible-panel-height);
                transition: height 100ms linear;
              }

              .transition-test-panel[data-starting-style],
              .transition-test-panel[data-ending-style] {
                height: 0;
              }
            `}</style>

            <button type="button" onClick={() => setMotionEnabled(true)}>
              enable motion
            </button>

            <Collapsible.Root>
              <Collapsible.Trigger>Trigger</Collapsible.Trigger>
              <Collapsible.Panel
                class={motionEnabled() ? 'transition-test-panel' : undefined}
                data-testid="panel"
                hiddenUntilFound
                keepMounted
                style={motionEnabled() ? { 'transition-duration': '123ms' } : undefined}
              >
                {PANEL_CONTENT}
              </Collapsible.Panel>
            </Collapsible.Root>
          </>
        );
      }

      const { user } = await render(() => <App />);

      const panel = screen.getByTestId('panel');
      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const enableMotion = screen.getByRole('button', { name: 'enable motion' });

      fireBeforeMatch(panel);

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-open');
      });

      await user.click(trigger);

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-closed');
      });

      await user.click(enableMotion);
      fireEvent.click(trigger);

      expect(panel).toHaveAttribute('data-open');
      expect(panel.style.transitionDuration).toBe('123ms');
    });

    // Solid: `Activity` (test/activity.tsx) hides its content as React's does in the DOM.
    it('restores the inline transition duration when an instant open is interrupted', async () => {
      function App() {
        const [visible, setVisible] = createSignal(true);

        return (
          <>
            <style>{`
              .transition-test-panel {
                overflow: hidden;
                height: var(--collapsible-panel-height);
                transition-property: height;
                transition-duration: 999ms;
                transition-timing-function: linear;
              }

              .transition-test-panel[data-starting-style],
              .transition-test-panel[data-ending-style] {
                height: 0;
              }
            `}</style>

            <button type="button" onClick={() => setVisible((prev) => !prev)}>
              toggle activity
            </button>

            <Activity mode={visible() ? 'visible' : 'hidden'}>
              <Collapsible.Root>
                <Collapsible.Trigger>Trigger</Collapsible.Trigger>
                <Collapsible.Panel
                  class="transition-test-panel"
                  data-testid="panel"
                  hiddenUntilFound
                  keepMounted
                  style={{ 'transition-duration': '123ms' }}
                >
                  {PANEL_CONTENT}
                </Collapsible.Panel>
              </Collapsible.Root>
            </Activity>
          </>
        );
      }

      await render(() => <App />);

      const panel = screen.getByTestId('panel');
      const toggle = screen.getByRole('button', { name: 'toggle activity' });

      fireBeforeMatch(panel);
      fireEvent.click(toggle);
      // Solid: React commits the hide at once and tears the panel's effects down; here the panel
      // sees the hide once it is rendered.
      await waitForAnimationFrame();
      await waitForAnimationFrame();

      fireEvent.click(toggle);

      await waitFor(() => {
        expect({
          open: panel.hasAttribute('data-open'),
          transitionDuration: panel.style.transitionDuration,
        }).toEqual({ open: true, transitionDuration: '123ms' });
      });
    });

    it('does not keep a hidden transition running after a hiddenUntilFound panel closes', async ({
      onTestFinished,
    }) => {
      // With animations disabled the close completes without waiting for transitions, so a
      // transition left over depended on whether the open had a frame to start one. Enabled, the
      // panel hides only after its close transition finishes, which is what this asserts.
      const animationsDisabled = globalThis.BASE_UI_ANIMATIONS_DISABLED;
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;
      onTestFinished(() => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = animationsDisabled;
      });

      const { user } = await render(() => (
        <>
          <style>{`
            .transition-test-panel {
              overflow: hidden;
              height: var(--collapsible-panel-height);
              opacity: 1;
              transition:
                height 1000ms linear,
                opacity 1000ms linear;
            }

            .transition-test-panel[data-starting-style],
            .transition-test-panel[data-ending-style] {
              height: 0;
              opacity: 0;
            }
          `}</style>

          <Collapsible.Root>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel class="transition-test-panel" data-testid="panel" hiddenUntilFound>
              {PANEL_CONTENT}
            </Collapsible.Panel>
          </Collapsible.Root>
        </>
      ));

      const panel = screen.getByTestId('panel');
      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.click(trigger);

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-open');
      });

      await user.click(trigger);

      await waitFor(
        () => {
          expect(panel).toHaveAttribute('hidden', 'until-found');
        },
        { timeout: 3000 },
      );

      await act(async () => {
        await waitForAnimationFrame();
        await waitForAnimationFrame();
      });

      expect(
        panel.getAnimations().filter((animation) => animation.playState !== 'finished').length,
      ).toBe(0);
      expect(getComputedStyle(panel).opacity).toBe('0');
    });
  });

  // we test firefox in browserstack which does not support this yet
  describe.skipIf(!('onbeforematch' in window) || isJSDOM)('prop: hiddenUntilFound', () => {
    it('does not open or suppress the next trigger open when beforematch is canceled', async () => {
      const handleOpenChange = vi.fn(
        (nextOpen, eventDetails: Collapsible.Root.ChangeEventDetails) => {
          if (eventDetails.reason === REASONS.none) {
            eventDetails.cancel();
          }
        },
      );

      const { user } = await render(() => (
        <>
          <style>{`
            .transition-test-panel {
              overflow: hidden;
              height: var(--collapsible-panel-height);
              transition-property: height;
              transition-duration: 999ms;
              transition-timing-function: linear;
            }

            .transition-test-panel[data-starting-style],
            .transition-test-panel[data-ending-style] {
              height: 0;
            }
          `}</style>

          <Collapsible.Root onOpenChange={handleOpenChange}>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel
              class="transition-test-panel"
              data-testid="panel"
              hiddenUntilFound
              keepMounted
              // Verifies canceled beforematch does not install the temporary 0s override.
              style={{ 'transition-duration': '123ms' }}
            >
              {PANEL_CONTENT}
            </Collapsible.Panel>
          </Collapsible.Root>
        </>
      ));

      const panel = screen.getByTestId('panel');
      const trigger = screen.getByRole('button', { name: 'Trigger' });

      fireBeforeMatch(panel);
      // The browser drops `hidden` as part of revealing the match, regardless of
      // what the event handler decided.
      panel.removeAttribute('hidden');

      expect(handleOpenChange).toHaveBeenCalledOnce();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(panel).toHaveAttribute('data-closed');
      // A canceled reveal must leave the collapsed styles in place.
      expect(panel).toHaveAttribute('data-starting-style');
      expect(getComputedStyle(panel).height).toBe('0px');

      // A canceled reveal must also stay hidden and searchable.
      await waitFor(() => {
        expect(panel).toHaveAttribute('hidden', 'until-found');
      });

      await user.click(trigger);

      expect(handleOpenChange).toHaveBeenCalledTimes(2);
      expect(panel).toHaveAttribute('data-open');
      expect(panel.style.transitionDuration).toBe('123ms');
    });

    it('expands the panel while beforematch is being dispatched', async () => {
      await render(() => (
        <>
          <style>{`
            .transition-test-panel {
              overflow: hidden;
              height: var(--collapsible-panel-height);
              transition-property: height;
              transition-duration: 999ms;
              transition-timing-function: linear;
            }

            .transition-test-panel[data-starting-style],
            .transition-test-panel[data-ending-style] {
              height: 0;
            }
          `}</style>

          <Collapsible.Root>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel class="transition-test-panel" data-testid="panel" hiddenUntilFound>
              {PANEL_CONTENT}
            </Collapsible.Panel>
          </Collapsible.Root>
        </>
      ));

      const panel = screen.getByTestId('panel');

      expect(panel).toHaveAttribute('data-starting-style');

      let startingStyleWhenRevealed: boolean | undefined;
      let heightWhenRevealed: string | undefined;

      // Registered after the component's own listener, so this observes the panel
      // from where the browser does: the same task, once `beforematch` handling is
      // done. The browser drops `hidden` and measures the match there, and a panel
      // still holding its collapsed starting styles measures as zero-sized.
      panel.addEventListener('beforematch', () => {
        startingStyleWhenRevealed = panel.hasAttribute('data-starting-style');
        panel.removeAttribute('hidden');
        heightWhenRevealed = getComputedStyle(panel).height;
      });

      fireBeforeMatch(panel);

      expect(startingStyleWhenRevealed).toBe(false);
      expect(heightWhenRevealed).not.toBe('0px');
    });

    it('re-collapses the panel when the open state never arrives', async () => {
      function App() {
        const [open, setOpen] = createSignal(false);
        const [tick, setTick] = createSignal(0);

        return (
          <>
            <style>{`
              .transition-test-panel {
                overflow: hidden;
                height: var(--collapsible-panel-height);
                transition-property: height;
                transition-duration: 999ms;
                transition-timing-function: linear;
              }

              .transition-test-panel[data-starting-style],
              .transition-test-panel[data-ending-style] {
                height: 0;
              }
            `}</style>

            <button type="button" onClick={() => setTick((value) => value + 1)}>
              Rerender
            </button>
            <span data-testid="tick">{tick()}</span>

            <Collapsible.Root
              open={open()}
              onOpenChange={(nextOpen, eventDetails) => {
                // Opts out of find-in-page reveals while still honoring the trigger.
                if (eventDetails.reason === REASONS.none) {
                  return;
                }

                setOpen(nextOpen);
              }}
            >
              <Collapsible.Trigger>Trigger</Collapsible.Trigger>
              <Collapsible.Panel
                class="transition-test-panel"
                data-testid="panel"
                hiddenUntilFound
                style={{ 'transition-duration': '123ms' }}
              >
                {PANEL_CONTENT}
              </Collapsible.Panel>
            </Collapsible.Root>
          </>
        );
      }

      const { user } = await render(() => <App />);

      const panel = screen.getByTestId('panel');

      expect(panel).toHaveAttribute('data-starting-style');

      fireBeforeMatch(panel);
      // The browser drops `hidden` as part of revealing the match.
      panel.removeAttribute('hidden');

      // The closed props do not change, so they cannot restore `hidden` on their own.
      await waitFor(() => {
        expect(panel).toHaveAttribute('hidden', 'until-found');
      });
      expect(panel).toHaveAttribute('data-starting-style');
      expect(getComputedStyle(panel).height).toBe('0px');

      await user.click(screen.getByRole('button', { name: 'Rerender' }));

      expect(panel).toHaveAttribute('data-starting-style');
      expect(getComputedStyle(panel).height).toBe('0px');

      // The reveal never opened the panel, so it must not consume the motion of the
      // next ordinary open.
      await user.click(screen.getByRole('button', { name: 'Trigger' }));

      expect(panel).toHaveAttribute('data-open');
      expect(getComputedStyle(panel).transitionDuration).toBe('0.123s');
    });

    it('does not re-hide a panel that opens before the reveal revert paints', async () => {
      const frames: FrameRequestCallback[] = [];
      const request = vi.spyOn(AnimationFrame, 'request').mockImplementation((callback) => {
        frames.push(callback);
        return frames.length;
      });

      try {
        function App() {
          const [open, setOpen] = createSignal(false);
          return (
            <Collapsible.Root
              open={open()}
              onOpenChange={(nextOpen, eventDetails) => {
                if (eventDetails.reason === REASONS.none) {
                  return;
                }
                setOpen(nextOpen);
              }}
            >
              <Collapsible.Trigger>Trigger</Collapsible.Trigger>
              <Collapsible.Panel data-testid="panel" hiddenUntilFound>
                {PANEL_CONTENT}
              </Collapsible.Panel>
            </Collapsible.Root>
          );
        }

        const { user } = await render(() => <App />);
        const panel = screen.getByTestId('panel');

        fireBeforeMatch(panel);
        panel.removeAttribute('hidden');

        await act(async () => {
          await new Promise((resolve) => {
            setTimeout(resolve, 0);
          });
        });

        const revert = frames.at(-1);
        expect(revert).toEqual(expect.any(Function));

        await user.click(screen.getByRole('button', { name: 'Trigger' }));
        revert?.(0);

        expect(panel).toHaveAttribute('data-open');
        expect(panel).not.toHaveAttribute('hidden');
      } finally {
        request.mockRestore();
      }
    });

    it('uses `hidden="until-found" to hide panel when true', async () => {
      const handleOpenChange = vi.fn();

      await render(() => (
        <Collapsible.Root defaultOpen={false} onOpenChange={handleOpenChange}>
          <Collapsible.Trigger />
          <Collapsible.Panel hiddenUntilFound keepMounted>
            {PANEL_CONTENT}
          </Collapsible.Panel>
        </Collapsible.Root>
      ));

      const panel = screen.getByText(PANEL_CONTENT);

      fireBeforeMatch(panel);

      expect(handleOpenChange.mock.calls.length).toBe(1);
      expect(panel).toHaveAttribute('data-open');
    });

    it('re-collapses a keyframe panel when the open state never arrives', async () => {
      function App() {
        const [open, setOpen] = createSignal(false);

        return (
          <>
            <style>{`
                @keyframes test-panel-slide-down {
                  from { height: 0; }
                  to { height: var(--collapsible-panel-height); }
                }

                @keyframes test-panel-slide-up {
                  from { height: var(--collapsible-panel-height); }
                  to { height: 0; }
                }

                .animation-test-panel {
                  overflow: hidden;
                }

                .animation-test-panel[data-open] {
                  animation: test-panel-slide-down 100ms ease-out;
                }

                .animation-test-panel[data-closed] {
                  animation: test-panel-slide-up 100ms ease-in;
                }
              `}</style>

            <Collapsible.Root
              open={open()}
              onOpenChange={(nextOpen, eventDetails) => {
                // Opts out of find-in-page reveals while still honoring the trigger.
                if (eventDetails.reason === REASONS.none) {
                  return;
                }

                setOpen(nextOpen);
              }}
            >
              <Collapsible.Trigger>Trigger</Collapsible.Trigger>
              <Collapsible.Panel class="animation-test-panel" data-testid="panel" hiddenUntilFound>
                {PANEL_CONTENT}
              </Collapsible.Panel>
            </Collapsible.Root>
          </>
        );
      }

      const { user } = await render(() => <App />);

      const panel = screen.getByTestId('panel');
      const trigger = screen.getByRole('button', { name: 'Trigger' });

      // A full open/close cycle reaches the steady state where the closed panel
      // no longer carries `data-starting-style` (keyframe panels only hold it
      // until the animation type has been detected).
      await user.click(trigger);
      await user.click(trigger);

      await waitFor(() => {
        expect(panel).toHaveAttribute('hidden', 'until-found');
      });
      expect(panel).not.toHaveAttribute('data-starting-style');

      fireBeforeMatch(panel);
      // The browser drops `hidden` as part of revealing the match.
      panel.removeAttribute('hidden');

      // The panel returns to the fully closed state without gaining attributes
      // React does not render for it.
      await waitFor(() => {
        expect(panel).toHaveAttribute('hidden', 'until-found');
      });
      expect(panel).not.toHaveAttribute('data-starting-style');

      // The reveal never opened the panel, so it must not consume the motion of
      // the next ordinary open.
      await user.click(trigger);

      expect(panel).toHaveAttribute('data-open');
      expect(getComputedStyle(panel).animationDuration).toBe('0.1s');
      expect(panel.getAnimations().length).toBeGreaterThan(0);
    });
  });
});
