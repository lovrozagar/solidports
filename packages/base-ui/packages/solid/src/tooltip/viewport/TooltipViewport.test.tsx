import {
  act,
  createRenderer,
  describeConformance,
  isJSDOM,
  viewportConformanceTests,
} from '#test-utils';
import { Tooltip } from '@solidports/base-ui/tooltip';
import { screen, waitFor } from '@solidjs/testing-library';
import { expect, describe } from 'vitest';
import { For, omit } from 'solid-js';

describe('<Tooltip.Viewport />', () => {
  const { render } = createRenderer();

  describeConformance(Tooltip.Viewport, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node, props) {
      return render(() => (
        <Tooltip.Root open>
          <Tooltip.Trigger>Trigger</Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup>{node(props!)}</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      ));
    },
  }));

  viewportConformanceTests({
    render,
    openOn: 'focus',
    createComponent: (props) => (
      <Tooltip.Root {...props.root}>
        {(data) => (
          <>
            <For each={props.triggers}>
              {(trigger) => <Tooltip.Trigger delay={0} {...omit(trigger, 'key')} />}
            </For>
            <Tooltip.Portal {...props.portal}>
              <Tooltip.Positioner {...props.positioner}>
                <Tooltip.Popup {...props.popup}>
                  <Tooltip.Viewport {...props.viewport}>
                    {props.renderContent(() => data.payload)}
                  </Tooltip.Viewport>
                </Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </>
        )}
      </Tooltip.Root>
    ),
  });

  it.skipIf(isJSDOM)('anchors the positioner from the far edge while it transitions', async () => {
    render(() => (
      <Tooltip.Root>
        <style>{`[data-testid="positioner"] { transition: transform 100ms; }`}</style>
        {/* Leave room on the left so the popup does not flip. */}
        <Tooltip.Trigger
          delay={0}
          closeDelay={0}
          style={{ position: 'fixed', top: '200px', left: '300px' }}
        >
          Trigger
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner side="left" data-testid="positioner">
            <Tooltip.Popup>
              <Tooltip.Viewport>Content</Tooltip.Viewport>
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));

    const trigger = screen.getByRole('button', { name: 'Trigger' });

    await act(async () => trigger.focus());

    const positioner = await screen.findByTestId('positioner');

    await waitFor(() => {
      expect(positioner).toHaveAttribute('data-side', 'left');
    });

    // A transitioning popup on the left side is positioned from the right edge so a size change
    // keeps its far edge in place.
    await waitFor(() => {
      expect(positioner.style.right).not.toBe('');
    });
    expect(positioner.style.left).toBe('');
  });

  it.skipIf(isJSDOM)('should mirror the instant animation type of the tooltip', async () => {
    render(() => (
      <Tooltip.Root>
        <Tooltip.Trigger delay={0} closeDelay={0}>
          Trigger
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup>
              <Tooltip.Viewport data-testid="viewport">Content</Tooltip.Viewport>
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));

    const trigger = screen.getByRole('button', { name: 'Trigger' });

    await act(async () => trigger.focus());

    await waitFor(() => {
      expect(screen.getByTestId('viewport')).toHaveAttribute('data-instant', 'focus');
    });
  });
});
