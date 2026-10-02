import { expect, vi, describe, it } from 'vitest';
import { screen, waitFor } from '@solidjs/testing-library';
import { Accordion } from '@solidports/base-ui/accordion';
import { createRenderer, describeConformance, isJSDOM } from '#test-utils';

const PANEL_CONTENT = 'This is panel content';

describe('<Accordion.Panel />', () => {
  const { render } = createRenderer();

  describeConformance(
    (props) => <Accordion.Panel keepMounted {...props} ref={props.ref} />,
    () => ({
      render: (node, props) =>
        render(() => (
          <Accordion.Root>
            <Accordion.Item>{node(props!)}</Accordion.Item>
          </Accordion.Root>
        )),
      refInstanceof: window.HTMLDivElement,
    }),
  );

  it('warns when a panel enables hiddenUntilFound and disables keepMounted', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      await render(() => (
        <Accordion.Root>
          <Accordion.Item>
            <Accordion.Panel hiddenUntilFound keepMounted={false}>
              {PANEL_CONTENT}
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>
      ));

      expect(warnSpy).toHaveBeenCalledWith(
        'Base UI: The `keepMounted={false}` prop on an `Accordion.Panel` is ignored when `hiddenUntilFound` is enabled on the panel or root, since the panel must remain mounted while closed.',
      );
      expect(screen.getByText(PANEL_CONTENT).getAttribute('hidden')).toBe('until-found');
    } finally {
      warnSpy.mockRestore();
    }
  });

  describe('server-side rendering', () => {
    // Solid: the test harness has no string renderer; the client render covers the same
    // first-paint suppression of the initial keyframe animation.
    it('suppresses the initial keyframe animation from inline styles when rendered open', async () => {
      await render(() => (
        <>
          <style>{`
            @keyframes panel-slide-down {
              from {
                height: 0;
              }

              to {
                height: var(--accordion-panel-height);
              }
            }
          `}</style>

          <Accordion.Root defaultValue={[0]}>
            <Accordion.Item value={0}>
              <Accordion.Header>
                <Accordion.Trigger>Trigger</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel
                data-testid="panel"
                style={{
                  'animation-duration': '100ms',
                  'animation-name': 'panel-slide-down',
                  'animation-timing-function': 'linear',
                }}
              >
                {PANEL_CONTENT}
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion.Root>
        </>
      ));

      const panel = screen.getByTestId('panel');

      expect(panel.style.animationName).toBe('none');
      expect(panel.style.animationDuration).toBe('100ms');
    });
  });

  it('passes root keepMounted to closed panels', async () => {
    await render(() => (
      <Accordion.Root keepMounted>
        <Accordion.Item value={0}>
          <Accordion.Header>
            <Accordion.Trigger>Trigger</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>{PANEL_CONTENT}</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    ));

    expect(screen.getByText(PANEL_CONTENT)).toHaveAttribute('hidden');
  });

  it('passes root hiddenUntilFound to closed panels and allows panel overrides', async () => {
    await render(() => (
      <Accordion.Root hiddenUntilFound keepMounted>
        <Accordion.Item value={0}>
          <Accordion.Header>
            <Accordion.Trigger>Trigger 1</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>{PANEL_CONTENT}</Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value={1}>
          <Accordion.Header>
            <Accordion.Trigger>Trigger 2</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel hiddenUntilFound={false} keepMounted={false}>
            Overridden panel
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    ));

    expect(screen.getByText(PANEL_CONTENT).getAttribute('hidden')).toBe('until-found');
    expect(screen.queryByText('Overridden panel')).toBe(null);
  });

  describe.skipIf(isJSDOM)('CSS transitions', () => {
    it('keeps the closing panel visible until its exit transition completes when switching items', async () => {
      const { user } = await render(() => (
        <>
          <style>{`
            .transition-test-panel {
              overflow: hidden;
              height: var(--accordion-panel-height);
              transition: height 300ms linear;
            }

            .transition-test-panel[data-starting-style],
            .transition-test-panel[data-ending-style] {
              height: 0;
            }
          `}</style>

          <Accordion.Root defaultValue={[0]} multiple={false}>
            <Accordion.Item value={0}>
              <Accordion.Header>
                <Accordion.Trigger>Trigger 1</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel class="transition-test-panel" data-testid="panel-1" keepMounted>
                First panel
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value={1}>
              <Accordion.Header>
                <Accordion.Trigger>Trigger 2</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel class="transition-test-panel" data-testid="panel-2" keepMounted>
                Second panel
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion.Root>
        </>
      ));

      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
      const panel1 = screen.getByTestId('panel-1');
      const panel2 = screen.getByTestId('panel-2');

      await waitFor(() => {
        expect(panel1).toHaveAttribute('data-open');
        expect(panel1.style.getPropertyValue('--accordion-panel-height')).toBe('auto');
      });

      await user.click(trigger2);

      await waitFor(() => {
        expect(panel1).toHaveAttribute('data-ending-style');
        expect(panel1).not.toHaveAttribute('hidden');
        expect(panel1.style.getPropertyValue('--accordion-panel-height')).toMatch(/px$/);
        expect(panel2).toHaveAttribute('data-open');
      });

      await waitFor(() => {
        expect(panel1).toHaveAttribute('hidden');
        expect(panel2).not.toHaveAttribute('hidden');
      });
    });
  });

  describe.skipIf(isJSDOM)('React.Activity', () => {
    // Solid: no React.Activity equivalent; effects are never torn down while state is kept.
    it.skip('does not replay open keyframe animations from inline styles when revealing a panel opened by the user', () => {});
  });
});
