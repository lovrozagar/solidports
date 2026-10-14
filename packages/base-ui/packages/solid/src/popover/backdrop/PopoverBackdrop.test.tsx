import { describe, expect, it } from 'vitest';
import { createEffect } from 'solid-js';
import { createRenderer, describeConformance } from '#test-utils';
import { Popover } from '@solidports/base-ui/popover';
import { screen, waitFor } from '@solidjs/testing-library';

describe('<Popover.Backdrop />', () => {
  const { render } = createRenderer();

  describeConformance(Popover.Backdrop, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node, props) => render(() => <Popover.Root open>{node(props!)}</Popover.Root>),
  }));

  it.each([false, true])(
    'does not start an entry phase when initially open (controlled=%s)',
    async (controlled) => {
      const statuses = new Set<Popover.Backdrop.State['transitionStatus']>();

      // Solid: an effect over the state records each committed value, as React's layout effect.
      function RecordState(props: { state: Popover.Backdrop.State }) {
        createEffect(
          () => props.state.transitionStatus,
          (status) => {
            statuses.add(status);
          },
        );
        return null;
      }

      await render(() => (
        <Popover.Root open={controlled ? true : undefined} defaultOpen={!controlled}>
          <Popover.Backdrop
            render={(props: Record<string, unknown>, state: Popover.Backdrop.State) => (
              <div {...props}>
                <RecordState state={state} />
              </div>
            )}
          />
        </Popover.Root>
      ));

      expect(statuses).toEqual(new Set([undefined]));
    },
  );

  it('sets `pointer-events: none` style on backdrop if opened by hover', async () => {
    const { user } = render(() => (
      <Popover.Root>
        <Popover.Trigger delay={0} openOnHover>
          Open
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Backdrop data-testid="backdrop" />
          <Popover.Positioner>
            <Popover.Popup />
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));

    await user.hover(screen.getByText('Open'));

    expect(screen.getByTestId('backdrop').style.pointerEvents).to.equal('none');
  });

  it('does not set `pointer-events: none` style on backdrop if opened by click', async () => {
    const { user } = render(() => (
      <Popover.Root>
        <Popover.Trigger openOnHover>Open</Popover.Trigger>
        <Popover.Portal>
          <Popover.Backdrop data-testid="backdrop" />
          <Popover.Positioner>
            <Popover.Popup />
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));

    await user.click(screen.getByText('Open'));

    await waitFor(() => {
      expect(screen.getByTestId('backdrop').style.pointerEvents).not.to.equal('none');
    });
  });
});
